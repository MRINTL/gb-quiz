// Security-rules + realtime smoke test against the local Firebase emulators.
// Run: npm run test:rules   (wraps `firebase emulators:exec`)
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-hb-quiz';
const CARD_VALUES = [100, 200, 300, 400, 500, 600];
const cardIds = [];
for (let c = 0; c < 6; c += 1) for (const v of CARD_VALUES) cardIds.push(`c${c}_${v}`);
const initialCards = Object.fromEntries(cardIds.map((id) => [id, 'available']));

async function client(name) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT_ID, appId: `1:0:web:${name}` }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const { user } = await signInAnonymously(auth);
  return { db, uid: user.uid };
}

let failures = 0;
async function expectAllowed(label, action) {
  try {
    await action();
    console.log(`  ✓ allowed  ${label}`);
  } catch (error) {
    failures += 1;
    console.log(`  ✗ EXPECTED ALLOW  ${label}: ${error.code ?? error.message}`);
  }
}
async function expectDenied(label, action) {
  try {
    await action();
    failures += 1;
    console.log(`  ✗ EXPECTED DENY  ${label}`);
  } catch (error) {
    if (error.code === 'permission-denied') console.log(`  ✓ denied   ${label}`);
    else {
      failures += 1;
      console.log(`  ✗ unexpected error  ${label}: ${error.code ?? error.message}`);
    }
  }
}

const host = await client('host');
const player = await client('player');
const roomId = 'ABCDEFGH2345';
const roomOf = (db) => doc(db, 'hbquiz_rooms', roomId);
const contentOf = (db) => doc(db, 'hbquiz_rooms', roomId, 'private', 'content');

console.log('Room creation');
await expectDenied('room id with forbidden characters', () =>
  setDoc(doc(host.db, 'hbquiz_rooms', 'abc'), {
    hostUid: host.uid, categories: ['', '', '', '', '', ''], cards: initialCards,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }),
);
await expectDenied('create room on behalf of another uid', () =>
  setDoc(doc(player.db, 'hbquiz_rooms', 'ZZZZZZZZ2222'), {
    hostUid: host.uid, categories: ['', '', '', '', '', ''], cards: initialCards,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }),
);
await expectAllowed('host creates room + private content in one batch', async () => {
  const batch = writeBatch(host.db);
  batch.set(roomOf(host.db), {
    hostUid: host.uid,
    categories: ['История', 'География', 'Наука', 'Кино', 'Музыка', 'Спорт'],
    cards: initialCards,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(contentOf(host.db), { questions: {} });
  await batch.commit();
});

console.log('Host');
await expectAllowed('host saves a question', () =>
  updateDoc(contentOf(host.db), { 'questions.c0_300': { question: 'Q?', answer: 'A' } }),
);
await expectAllowed('host reads questions', () => getDoc(contentOf(host.db)));
await expectAllowed('host renames teams', () =>
  updateDoc(contentOf(host.db), { teamNames: ['Синие', 'Красные'] }),
);
await expectAllowed('host awards a card to team 2', () => updateDoc(contentOf(host.db), { 'awards.c0_300': 1 }));
await expectDenied('host awards a card to a non-existent team', () =>
  updateDoc(contentOf(host.db), { 'awards.c0_300': 5 }),
);
await expectDenied('host adds three teams', () =>
  updateDoc(contentOf(host.db), { teamNames: ['A', 'B', 'C'] }),
);
await expectAllowed('host opens card', () =>
  updateDoc(roomOf(host.db), { 'cards.c0_300': 'opened', updatedAt: serverTimestamp() }),
);
await expectDenied('host puts an answer into the public room doc', () =>
  updateDoc(roomOf(host.db), { answers: { c0_300: 'A' }, updatedAt: serverTimestamp() }),
);
await expectDenied('host sets an unknown card status', () =>
  updateDoc(roomOf(host.db), { 'cards.c0_300': 'hacked', updatedAt: serverTimestamp() }),
);
await expectDenied('host transfers room to another uid', () =>
  updateDoc(roomOf(host.db), { hostUid: player.uid, updatedAt: serverTimestamp() }),
);

console.log('Player');
await expectAllowed('player reads public room', async () => {
  const snapshot = await getDoc(roomOf(player.db));
  if (!snapshot.exists()) throw new Error('room not visible');
});
await expectDenied('player reads questions/answers/scoreboard', () => getDoc(contentOf(player.db)));
await expectDenied('player changes the score', () => updateDoc(contentOf(player.db), { 'awards.c0_100': 0 }));
await expectDenied('player writes questions', () =>
  updateDoc(contentOf(player.db), { 'questions.c0_100': { question: 'x', answer: 'y' } }),
);
await expectDenied('player completes a card', () =>
  updateDoc(roomOf(player.db), { 'cards.c0_300': 'completed', updatedAt: serverTimestamp() }),
);
await expectDenied('player overwrites room via set', () =>
  setDoc(roomOf(player.db), {
    hostUid: player.uid, categories: ['', '', '', '', '', ''], cards: initialCards,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }),
);
await expectDenied('player lists all rooms', () => getDocs(collection(player.db, 'hbquiz_rooms')));

console.log('Realtime');
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('player did not receive update within 5 s')), 5000);
  let startedAt = 0;
  const unsubscribe = onSnapshot(roomOf(player.db), (snapshot) => {
    const status = snapshot.data()?.cards?.c0_300;
    if (!startedAt) {
      startedAt = performance.now();
      void updateDoc(roomOf(host.db), { 'cards.c0_300': 'completed', updatedAt: serverTimestamp() });
      return;
    }
    if (status === 'completed') {
      clearTimeout(timeout);
      unsubscribe();
      console.log(`  ✓ player saw "completed" ${Math.round(performance.now() - startedAt)} ms after host write`);
      resolve();
    }
  }, reject);
}).catch((error) => {
  failures += 1;
  console.log(`  ✗ ${error.message}`);
});

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
