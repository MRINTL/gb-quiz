import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  deleteField,
  doc,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore';
import {
  CATEGORY_COUNT,
  DEFAULT_TEAM_NAMES,
  MAX_CATEGORY_NAME_LENGTH,
  MAX_TEAM_NAME_LENGTH,
  TEAM_COUNT,
  allCardIds,
  isTeamIndex,
  type AwardMap,
  type CardId,
  type CardStatus,
  type CardStatusMap,
  type HostContent,
  type QuestionContent,
  type TeamIndex,
  type QuestionMap,
  type RoomState,
} from '../types';
import {
  demoContentKey,
  demoRoomKey,
  getDemoUid,
  readDemo,
  updateDemo,
  watchDemo,
  writeDemo,
  type DemoContentRecord,
  type DemoRoomRecord,
} from './demoBackend';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId && firebaseConfig.authDomain,
);

/** Without Firebase keys the app runs in a local demo mode (sync between tabs of one browser). */
export const isDemoMode = !isFirebaseConfigured;

/** The only user fields the app relies on. */
export interface AppUser {
  uid: string;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function getServices(): { auth: Auth; db: Firestore } {
  if (!isFirebaseConfigured) throw new Error('Firebase не настроен: заполните переменные VITE_FIREBASE_* в .env');
  if (!app || !auth || !db) {
    // Reuse an existing app/Firestore if this module is evaluated again (Vite hot reload in development);
    // initializing Firestore twice would throw and blank the page.
    const isFirstInit = getApps().length === 0;
    app = isFirstInit ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    // Local cache keeps the board visible offline and queues host writes until the connection returns.
    db = isFirstInit
      ? initializeFirestore(app, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        })
      : getFirestore(app);
    if (isFirstInit && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
      // Local development against `firebase emulators:start` (see README).
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
  }
  return { auth, db };
}

/* ---------- Auth ---------- */

let signInPromise: Promise<AppUser> | null = null;

/** Resolves with the current anonymous user, signing in on first use. */
export function ensureSignedIn(): Promise<AppUser> {
  if (signInPromise) return signInPromise;
  if (isDemoMode) {
    signInPromise = Promise.resolve({ uid: getDemoUid() });
    return signInPromise;
  }
  const { auth: authInstance } = getServices();
  signInPromise = new Promise<User>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      authInstance,
      (user) => {
        unsubscribe();
        if (user) {
          resolve(user);
          return;
        }
        signInAnonymously(authInstance)
          .then((credential) => resolve(credential.user))
          .catch(reject);
      },
      reject,
    );
  }).catch((error: unknown) => {
    signInPromise = null;
    throw error;
  });
  return signInPromise;
}

/* ---------- Paths ---------- */

const ROOMS = 'hbquiz_rooms';
const PRIVATE = 'private';
const CONTENT_DOC = 'content';

function roomRef(roomId: string): DocumentReference {
  return doc(getServices().db, ROOMS, roomId);
}

function contentRef(roomId: string): DocumentReference {
  return doc(getServices().db, ROOMS, roomId, PRIVATE, CONTENT_DOC);
}

/* ---------- Room ID ---------- */

// No 0/O/1/I/L to keep codes easy to read aloud. 12 chars × 31 symbols ≈ 59 bits of entropy.
const ROOM_ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const ROOM_ID_LENGTH = 12;

export function generateRoomId(): string {
  const randomValues = new Uint32Array(ROOM_ID_LENGTH);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (value) => ROOM_ID_ALPHABET[value % ROOM_ID_ALPHABET.length]).join('');
}

export function normalizeRoomCode(input: string): string {
  // Accept a pasted link as well as a bare code.
  const fromLink = input.match(/room\/([A-Za-z0-9-]+)/)?.[1];
  return (fromLink ?? input).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function isValidRoomCode(code: string): boolean {
  return code.length === ROOM_ID_LENGTH && [...code].every((char) => ROOM_ID_ALPHABET.includes(char));
}

export function formatRoomCode(roomId: string): string {
  return roomId.match(/.{1,4}/g)?.join('-') ?? roomId;
}

/** Absolute player link that works on GitHub Pages thanks to HashRouter. */
export function buildPlayerLink(roomId: string): string {
  const baseUrl = window.location.href.split('#')[0] ?? '';
  return `${baseUrl}#/room/${roomId}`;
}

/* ---------- Defaults ---------- */

export const DEFAULT_CATEGORIES = ['История', 'География', 'Наука', 'Кино', 'Музыка', 'Спорт'];

function createInitialContent(): { questions: QuestionMap; teamNames: string[]; awards: AwardMap } {
  return { questions: {}, teamNames: [...DEFAULT_TEAM_NAMES], awards: {} };
}

/** Fills defaults so rooms created before teams existed keep working. */
function parseHostContent(data: Partial<DemoContentRecord> | undefined | null): HostContent {
  const teamNames = Array.from({ length: TEAM_COUNT }, (_, index) => {
    const name = data?.teamNames?.[index];
    return typeof name === 'string' ? name : (DEFAULT_TEAM_NAMES[index] ?? '');
  });
  const awards = Object.fromEntries(
    Object.entries(data?.awards ?? {}).filter(([, teamIndex]) => isTeamIndex(teamIndex)),
  ) as AwardMap;
  return { questions: (data?.questions ?? {}) as QuestionMap, teamNames, awards };
}

function createInitialCards(): CardStatusMap {
  return Object.fromEntries(allCardIds().map((id) => [id, 'available'])) as CardStatusMap;
}

/* ---------- Writes (host only, enforced by firestore.rules) ---------- */

/** Questions a new room starts with. Without a pack the room gets placeholder categories and no questions. */
export interface InitialQuestionPack {
  categories: string[];
  questions: QuestionMap;
}

export async function createRoom(initialPack?: InitialQuestionPack): Promise<string> {
  const user = await ensureSignedIn();
  const roomId = generateRoomId();
  const categories = Array.from(
    { length: CATEGORY_COUNT },
    (_, index) => initialPack?.categories[index] ?? DEFAULT_CATEGORIES[index] ?? '',
  );
  const content = { ...createInitialContent(), questions: initialPack?.questions ?? {} };

  if (isDemoMode) {
    writeDemo(demoRoomKey(roomId), {
      hostUid: user.uid,
      categories,
      cards: createInitialCards(),
    } satisfies DemoRoomRecord);
    writeDemo(demoContentKey(roomId), content satisfies DemoContentRecord);
    rememberHostedRoom(roomId);
    return roomId;
  }

  const { db: firestore } = getServices();

  const batch = writeBatch(firestore);
  batch.set(roomRef(roomId), {
    hostUid: user.uid,
    categories,
    cards: createInitialCards(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(contentRef(roomId), content);
  await batch.commit();

  rememberHostedRoom(roomId);
  return roomId;
}

export function setCardStatus(roomId: string, cardId: CardId, status: CardStatus): Promise<void> {
  if (isDemoMode) {
    return updateDemo<DemoRoomRecord>(demoRoomKey(roomId), (room) => ({
      ...room,
      cards: { ...room.cards, [cardId]: status },
    }));
  }
  return updateDoc(roomRef(roomId), { [`cards.${cardId}`]: status, updatedAt: serverTimestamp() });
}

export function renameCategory(
  roomId: string,
  currentCategories: string[],
  categoryIndex: number,
  newName: string,
): Promise<void> {
  const categories = Array.from({ length: CATEGORY_COUNT }, (_, index) =>
    index === categoryIndex
      ? newName.trim().slice(0, MAX_CATEGORY_NAME_LENGTH)
      : (currentCategories[index] ?? ''),
  );
  if (isDemoMode) return updateDemo<DemoRoomRecord>(demoRoomKey(roomId), (room) => ({ ...room, categories }));
  return updateDoc(roomRef(roomId), { categories, updatedAt: serverTimestamp() });
}

/** New game: every card available again and both scores back to zero. Questions and names stay. */
export async function resetBoard(roomId: string): Promise<void> {
  if (isDemoMode) {
    await updateDemo<DemoRoomRecord>(demoRoomKey(roomId), (room) => ({ ...room, cards: createInitialCards() }));
    await updateDemo<DemoContentRecord>(demoContentKey(roomId), (record) => ({ ...record, awards: {} }));
    return;
  }
  const batch = writeBatch(getServices().db);
  batch.update(roomRef(roomId), { cards: createInitialCards(), updatedAt: serverTimestamp() });
  batch.update(contentRef(roomId), { awards: {} });
  await batch.commit();
}

/** Gives the card's points to a team, or removes the award when teamIndex is null. Host-only data. */
export function setCardAward(roomId: string, cardId: CardId, teamIndex: TeamIndex | null): Promise<void> {
  if (isDemoMode) {
    return updateDemo<DemoContentRecord>(demoContentKey(roomId), (record) => {
      const awards = { ...(record.awards ?? {}) };
      if (teamIndex === null) delete awards[cardId];
      else awards[cardId] = teamIndex;
      return { ...record, awards };
    });
  }
  return updateDoc(contentRef(roomId), { [`awards.${cardId}`]: teamIndex === null ? deleteField() : teamIndex });
}

export function renameTeam(roomId: string, currentNames: string[], teamIndex: TeamIndex, newName: string): Promise<void> {
  const teamNames = Array.from({ length: TEAM_COUNT }, (_, index) =>
    index === teamIndex ? newName.trim().slice(0, MAX_TEAM_NAME_LENGTH) : (currentNames[index] ?? ''),
  );
  if (isDemoMode) {
    return updateDemo<DemoContentRecord>(demoContentKey(roomId), (record) => ({ ...record, teamNames }));
  }
  return updateDoc(contentRef(roomId), { teamNames });
}

export function saveQuestion(roomId: string, cardId: CardId, content: QuestionContent): Promise<void> {
  if (isDemoMode) {
    const cleaned = { question: content.question.trim(), answer: content.answer.trim() };
    return updateDemo<DemoContentRecord>(demoContentKey(roomId), (record) => ({
      ...record,
      questions: { ...record.questions, [cardId]: cleaned },
    }));
  }
  return updateDoc(contentRef(roomId), {
    [`questions.${cardId}`]: { question: content.question.trim(), answer: content.answer.trim() },
  });
}

/**
 * Replaces the imported categories and all their questions in one go.
 * Columns not covered by the pack keep their names and questions. Card statuses and scores are untouched.
 */
export async function importQuestionPack(
  roomId: string,
  current: { categories: string[]; questions: QuestionMap },
  pack: { categories: string[]; questions: QuestionMap },
): Promise<void> {
  const importedCount = Math.min(pack.categories.length, CATEGORY_COUNT);
  const categories = Array.from({ length: CATEGORY_COUNT }, (_, index) =>
    index < importedCount ? (pack.categories[index] ?? '') : (current.categories[index] ?? ''),
  );
  const keptQuestions = Object.fromEntries(
    Object.entries(current.questions).filter(([cardId]) => Number(cardId.slice(1, cardId.indexOf('_'))) >= importedCount),
  ) as QuestionMap;
  const questions: QuestionMap = { ...keptQuestions, ...pack.questions };

  if (isDemoMode) {
    await updateDemo<DemoRoomRecord>(demoRoomKey(roomId), (room) => ({ ...room, categories }));
    await updateDemo<DemoContentRecord>(demoContentKey(roomId), (record) => ({ ...record, questions }));
    return;
  }
  const batch = writeBatch(getServices().db);
  batch.update(roomRef(roomId), { categories, updatedAt: serverTimestamp() });
  batch.update(contentRef(roomId), { questions });
  await batch.commit();
}

/* ---------- Realtime subscriptions ---------- */

export interface RoomSnapshot {
  room: RoomState | null;
  /** True when data came from the local cache, i.e. the server is not reachable right now. */
  fromCache: boolean;
}

export function subscribeToRoom(
  roomId: string,
  onData: (snapshot: RoomSnapshot) => void,
  onError: (error: unknown) => void,
): () => void {
  if (isDemoMode) {
    return watchDemo(demoRoomKey(roomId), () => {
      const record = readDemo<DemoRoomRecord>(demoRoomKey(roomId));
      onData({
        room: record
          ? {
              id: roomId,
              hostUid: record.hostUid,
              categories: record.categories,
              cards: { ...createInitialCards(), ...(record.cards as CardStatusMap) },
            }
          : null,
        fromCache: false,
      });
    });
  }
  return onSnapshot(
    roomRef(roomId),
    { includeMetadataChanges: true },
    (snapshot) => {
      const data = snapshot.data();
      const room: RoomState | null = data
        ? {
            id: snapshot.id,
            hostUid: String(data.hostUid ?? ''),
            categories: Array.isArray(data.categories) ? (data.categories as string[]) : [],
            cards: { ...createInitialCards(), ...((data.cards ?? {}) as CardStatusMap) },
          }
        : null;
      onData({ room, fromCache: snapshot.metadata.fromCache });
    },
    onError,
  );
}

export function subscribeToHostContent(
  roomId: string,
  onData: (content: HostContent) => void,
  onError: (error: unknown) => void,
): () => void {
  if (isDemoMode) {
    return watchDemo(demoContentKey(roomId), () =>
      onData(parseHostContent(readDemo<DemoContentRecord>(demoContentKey(roomId)))),
    );
  }
  return onSnapshot(
    contentRef(roomId),
    (snapshot) => onData(parseHostContent(snapshot.data() as Partial<DemoContentRecord> | undefined)),
    onError,
  );
}

/* ---------- Host room history (this browser only) ---------- */

const HOSTED_ROOMS_KEY = 'brainquiz.hostedRooms';

export interface HostedRoomEntry {
  id: string;
  createdAt: number;
}

export function getHostedRooms(): HostedRoomEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(HOSTED_ROOMS_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? (parsed as HostedRoomEntry[]).filter((entry) => typeof entry?.id === 'string')
      : [];
  } catch {
    return [];
  }
}

function rememberHostedRoom(roomId: string): void {
  try {
    const rooms = [{ id: roomId, createdAt: Date.now() }, ...getHostedRooms().filter((r) => r.id !== roomId)];
    localStorage.setItem(HOSTED_ROOMS_KEY, JSON.stringify(rooms.slice(0, 20)));
  } catch {
    // Storage may be unavailable (private mode) — the room still works via its link.
  }
}

export function forgetHostedRoom(roomId: string): void {
  try {
    localStorage.setItem(HOSTED_ROOMS_KEY, JSON.stringify(getHostedRooms().filter((r) => r.id !== roomId)));
  } catch {
    // Storage unavailable — nothing to forget.
  }
}

/* ---------- Errors ---------- */

export function describeError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'permission-denied':
      return 'Нет доступа. Управлять комнатой может только ведущий, который её создал, в том же браузере.';
    case 'unavailable':
      return 'Нет связи с сервером. Изменения сохранятся и отправятся, когда интернет вернётся.';
    case 'not-found':
      return 'Комната не найдена. Проверьте код или ссылку.';
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'Анонимный вход не включён. Включите Anonymous в Firebase Console → Authentication → Sign-in method.';
    case 'auth/network-request-failed':
      return 'Не удалось подключиться к Firebase. Проверьте интернет.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return 'Неверный Firebase API key. Проверьте переменные VITE_FIREBASE_*.';
    default:
      return error instanceof Error ? error.message : 'Что-то пошло не так. Попробуйте ещё раз.';
  }
}
