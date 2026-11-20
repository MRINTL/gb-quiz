import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Lock } from 'lucide-react';

/**
 * Host password gate. Only the SHA-256 of the password is shipped in the bundle.
 * Override with VITE_HOST_PASSWORD_SHA256 (lowercase hex) to change the password without code edits.
 *
 * Note: on a static site this is an access barrier for the UI, not cryptographic protection —
 * the real write protection is still firestore.rules (host UID).
 */
const DEFAULT_PASSWORD_SHA256 = '172ef35ccc0e2c33f922fe5cb2499f66d1d2d7b716711e8e54acf6392944f883';
const PASSWORD_SHA256 = (
  (import.meta.env.VITE_HOST_PASSWORD_SHA256 as string | undefined) || DEFAULT_PASSWORD_SHA256
).toLowerCase();
const UNLOCK_KEY = 'brainquiz.hostUnlocked'; // legacy, see below

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);

/**
 * Plain-JS SHA-256. crypto.subtle exists only in secure contexts (https/localhost),
 * and the host may open the site by LAN IP over plain http.
 */
function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;
  new DataView(data.buffer).setUint32(paddedLength - 4, bytes.length * 8);

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  const view = new DataView(data.buffer);
  const rotr = (value: number, shift: number): number => (value >>> shift) | (value << (32 - shift));

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const w15 = words[i - 15]!;
      const w2 = words[i - 2]!;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      words[i] = (words[i - 16]! + s0 + words[i - 7]! + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = hash as unknown as number[] as [number, number, number, number, number, number, number, number];
    for (let i = 0; i < 64; i += 1) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + SHA256_K[i]! + words[i]!) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, h].forEach((value, index) => {
      hash[index] = (hash[index]! + value) | 0;
    });
  }
  return Array.from(hash, (word) => word.toString(16).padStart(8, '0')).join('');
}

/**
 * Unlock lives only in memory: the password is asked on every page load, new tab or reload.
 * Moving between host pages inside one session (create room → dashboard) does not ask again.
 */
let isUnlockedThisSession = false;

// Older builds remembered the unlock in localStorage — drop it so the password is always required.
try {
  localStorage.removeItem(UNLOCK_KEY);
} catch {
  // Storage unavailable — nothing to clean up.
}

export function HostGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(isUnlockedThisSession);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (unlocked) return <>{children}</>;

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    if (sha256Hex(password.trim()) === PASSWORD_SHA256) {
      isUnlockedThisSession = true;
      setUnlocked(true);
    } else {
      setError('Неверный пароль');
      setPassword('');
    }
  };

  return (
    <main className="host-start host-start--centered">
      <Link to="/" className="back-link back-link--narrow">
        <ArrowLeft size={18} /> На главную
      </Link>
      <motion.form
        className="panel panel--narrow"
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Lock className="panel__icon" size={28} aria-hidden />
        <h1 className="panel__title">Вход для ведущего</h1>
        <p className="panel__text">Введите пароль, чтобы создавать комнаты и управлять полем.</p>
        <label className="field">
          <span className="field__label">Пароль</span>
          <input
            className="field__input field__input--code"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button button--primary button--block" disabled={!password}>
          Войти
        </button>
      </motion.form>
    </main>
  );
}
