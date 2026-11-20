import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, FileUp, PencilRuler } from 'lucide-react';
import { Modal } from './Dialogs';
import { buildPlayerLink, formatRoomCode } from '../services/firebaseService';

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for insecure contexts / older browsers.
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }
}

export function CopyLinkButton({ roomId, compact = false }: { roomId: string; compact?: boolean }) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    if (await copyToClipboard(buildPlayerLink(roomId))) {
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1800);
    }
  };

  return (
    <button
      type="button"
      className={`button ${compact ? 'button--ghost button--small' : 'button--primary'}`}
      onClick={() => void handleCopy()}
      aria-label={isCopied ? 'Ссылка скопирована' : 'Копировать ссылку для игроков'}
      title="Копировать ссылку для игроков"
    >
      {isCopied ? <Check size={18} /> : <Copy size={18} />}
      <span className={compact ? 'hide-on-mobile' : undefined}>{isCopied ? 'Скопировано' : 'Копировать ссылку'}</span>
    </button>
  );
}

interface ShareRoomDialogProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  /** Host-only game preparation actions, kept here so the header stays minimal. */
  isEditMode?: boolean;
  onOpenImport?: () => void;
  onToggleEditMode?: () => void;
}

export function ShareRoomDialog({
  roomId,
  isOpen,
  onClose,
  isEditMode = false,
  onOpenImport,
  onToggleEditMode,
}: ShareRoomDialogProps) {
  const playerLink = buildPlayerLink(roomId);
  return (
    <Modal isOpen={isOpen} onClose={onClose} labelledBy="share-title">
      <div className="share">
        <h2 id="share-title" className="modal__title">
          Пригласить игроков
        </h2>
        <p className="share__hint">Отсканируйте QR-код или откройте ссылку. Регистрация не нужна.</p>
        <div className="share__qr">
          <QRCodeSVG value={playerLink} size={240} marginSize={2} bgColor="#F0F0F0" fgColor="#121212" level="M" />
        </div>
        <div className="share__code" aria-label="Код комнаты">
          {formatRoomCode(roomId)}
        </div>
        <input className="share__link" value={playerLink} readOnly onFocus={(event) => event.currentTarget.select()} />
        <CopyLinkButton roomId={roomId} />

        {(onOpenImport || onToggleEditMode) && (
          <section className="share__prep" aria-labelledby="share-prep-title">
            <h3 id="share-prep-title" className="share__prep-title">
              Подготовка игры
            </h3>
            <div className="share__prep-actions">
              {onOpenImport && (
                <button type="button" className="button button--ghost" onClick={onOpenImport}>
                  <FileUp size={18} /> Импорт вопросов
                </button>
              )}
              {onToggleEditMode && (
                <button
                  type="button"
                  className={`button ${isEditMode ? 'button--primary' : 'button--ghost'}`}
                  onClick={onToggleEditMode}
                  aria-pressed={isEditMode}
                >
                  <PencilRuler size={18} /> {isEditMode ? 'Закончить редактирование' : 'Редактировать поле'}
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
