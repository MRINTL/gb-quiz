import { useEffect, useState } from 'react';
import {
  describeError,
  ensureSignedIn,
  subscribeToHostContent,
  subscribeToRoom,
  type AppUser,
} from '../services/firebaseService';
import { DEFAULT_TEAM_NAMES, type ConnectionStatus, type HostContent, type RoomState } from '../types';

export function useAnonymousUser(): { user: AppUser | null; error: string | null } {
  const [user, setUser] = useState<AppUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const attemptSignIn = (): void => {
      ensureSignedIn()
        .then((signedInUser) => !cancelled && setUser(signedInUser))
        .catch((signInError: unknown) => !cancelled && setError(describeError(signInError)));
    };
    attemptSignIn();
    // Retry the sign-in automatically when the network comes back.
    const handleOnline = (): void => {
      setError(null);
      attemptSignIn();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return { user, error };
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = (): void => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return isOnline;
}

export interface RoomSubscription {
  room: RoomState | null;
  isLoading: boolean;
  isNotFound: boolean;
  error: string | null;
  connection: ConnectionStatus;
}

/** Live room state. Firestore reconnects on its own; we only reflect the status. */
export function useRoom(roomId: string | undefined, user: AppUser | null): RoomSubscription {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(true);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!roomId || !user) return undefined;
    setIsLoading(true);
    setError(null);
    return subscribeToRoom(
      roomId,
      (snapshot) => {
        setFromCache(snapshot.fromCache);
        setRoom(snapshot.room);
        // A missing doc reported by the server (not the cache) means the room really does not exist.
        if (snapshot.room || !snapshot.fromCache) setIsLoading(false);
        setIsNotFound(!snapshot.room && !snapshot.fromCache);
      },
      (subscribeError) => {
        setError(describeError(subscribeError));
        setIsLoading(false);
      },
    );
  }, [roomId, user]);

  const connection: ConnectionStatus = !isOnline ? 'offline' : fromCache ? 'syncing' : 'online';
  return { room, isLoading, isNotFound, error, connection };
}

const EMPTY_HOST_CONTENT: HostContent = { questions: {}, teamNames: DEFAULT_TEAM_NAMES, awards: {} };

/** Questions, answers, team names and awards — readable only by the room's host. */
export function useHostContent(
  roomId: string | undefined,
  enabled: boolean,
): { content: HostContent; error: string | null } {
  const [content, setContent] = useState<HostContent>(EMPTY_HOST_CONTENT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !enabled) return undefined;
    return subscribeToHostContent(roomId, setContent, (subscribeError) => setError(describeError(subscribeError)));
  }, [roomId, enabled]);

  return { content, error };
}
