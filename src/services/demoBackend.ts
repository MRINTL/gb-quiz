/**
 * Demo backend used when Firebase is not configured.
 * Stores rooms in localStorage and syncs instantly between tabs of the same browser
 * (via the `storage` event). It lets you try the whole host/player flow without any setup,
 * but it does NOT sync between different devices — that requires Firebase.
 */
import type { AwardMap, QuestionMap } from '../types';

const PREFIX = 'brainquiz.demo.';
const USER_KEY = `${PREFIX}uid`;
const LOCAL_CHANGE_EVENT = 'brainquiz-demo-change';

export interface DemoRoomRecord {
  hostUid: string;
  categories: string[];
  cards: Record<string, string>;
}

export interface DemoContentRecord {
  questions: QuestionMap;
  teamNames?: string[];
  awards?: AwardMap;
}

export const demoRoomKey = (roomId: string): string => `${PREFIX}room.${roomId}`;
export const demoContentKey = (roomId: string): string => `${PREFIX}content.${roomId}`;

export function getDemoUid(): string {
  try {
    const existing = localStorage.getItem(USER_KEY);
    if (existing) return existing;
    // getRandomValues works over plain http too (randomUUID needs a secure context).
    const uid = `demo-${Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(36)).join('')}`;
    localStorage.setItem(USER_KEY, uid);
    return uid;
  } catch {
    return 'demo-session';
  }
}

export function readDemo<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeDemo(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
  // `storage` fires only in OTHER tabs, so notify this tab ourselves.
  window.dispatchEvent(new CustomEvent(LOCAL_CHANGE_EVENT, { detail: key }));
}

export function updateDemo<T>(key: string, mutate: (current: T) => T): Promise<void> {
  const current = readDemo<T>(key);
  if (!current) return Promise.reject(Object.assign(new Error('not found'), { code: 'not-found' }));
  writeDemo(key, mutate(current));
  return Promise.resolve();
}

/** Calls `onChange` now and whenever the key changes in this or another tab. */
export function watchDemo(key: string, onChange: () => void): () => void {
  const handleStorage = (event: StorageEvent): void => {
    if (event.key === key) onChange();
  };
  const handleLocal = (event: Event): void => {
    if ((event as CustomEvent<string>).detail === key) onChange();
  };
  window.addEventListener('storage', handleStorage);
  window.addEventListener(LOCAL_CHANGE_EVENT, handleLocal);
  queueMicrotask(onChange);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(LOCAL_CHANGE_EVENT, handleLocal);
  };
}
