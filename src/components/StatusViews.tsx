import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Loader2, Wifi, WifiOff } from 'lucide-react';
import type { ConnectionStatus } from '../types';

const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  online: 'Онлайн',
  syncing: 'Подключение…',
  offline: 'Нет сети',
};

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const Icon = status === 'offline' ? WifiOff : status === 'syncing' ? Loader2 : Wifi;
  return (
    <span className={`connection connection--${status}`} role="status" aria-live="polite">
      <Icon size={14} className={status === 'syncing' ? 'spin' : undefined} aria-hidden />
      <span className="connection__label">{CONNECTION_LABEL[status]}</span>
    </span>
  );
}

interface FullPageMessageProps {
  title: string;
  description?: ReactNode;
  tone?: 'loading' | 'error' | 'info';
  actions?: ReactNode;
}

export function FullPageMessage({ title, description, tone = 'info', actions }: FullPageMessageProps) {
  return (
    <main className="full-message">
      <motion.div
        className="full-message__card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {tone === 'loading' && <Loader2 className="spin full-message__icon" size={36} aria-hidden />}
        {tone === 'error' && <AlertCircle className="full-message__icon full-message__icon--error" size={36} aria-hidden />}
        <h1 className="full-message__title">{title}</h1>
        {description && <div className="full-message__text">{description}</div>}
        {actions && <div className="full-message__actions">{actions}</div>}
      </motion.div>
    </main>
  );
}

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'error';
}

/** Minimal toast queue: one message at a time, auto-dismissed. */
export function useToast(): { toast: ToastMessage | null; showToast: (text: string, tone?: ToastMessage['tone']) => void } {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const showToast = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    window.clearTimeout(timerRef.current);
    setToast({ id: Date.now(), text, tone });
    timerRef.current = window.setTimeout(() => setToast(null), tone === 'error' ? 6000 : 2500);
  }, []);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);
  return { toast, showToast };
}

export function Toast({ toast }: { toast: ToastMessage | null }) {
  return (
    <div className="toast-region" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className={`toast toast--${toast.tone}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {toast.tone === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
