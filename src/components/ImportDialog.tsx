import { useMemo, useState, type ChangeEvent } from 'react';
import { FileUp } from 'lucide-react';
import { Modal } from './Dialogs';
import { parseQuestionPack } from '../services/questionPackParser';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (pack: ReturnType<typeof parseQuestionPack>) => void;
}

/**
 * Imports categories + questions from a Markdown file the host picks on their device.
 * The file is read locally and written only to the host-only Firestore doc — it never
 * becomes part of the public site bundle.
 */
export function ImportDialog({ isOpen, onClose, onImport }: ImportDialogProps) {
  const [sourceText, setSourceText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  const pack = useMemo(() => (sourceText.trim() ? parseQuestionPack(sourceText) : null), [sourceText]);

  const handleFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;
    setReadError(null);
    file
      .text()
      .then((text) => {
        setSourceText(text);
        setFileName(file.name);
      })
      .catch(() => setReadError('Не удалось прочитать файл.'));
  };

  const close = (): void => {
    setSourceText('');
    setFileName(null);
    setReadError(null);
    onClose();
  };

  const canImport = Boolean(pack && pack.questionCount > 0);

  return (
    <Modal isOpen={isOpen} onClose={close} labelledBy="import-title" size="large">
      <div className="import">
        <h2 id="import-title" className="modal__title">
          Импорт тем и вопросов
        </h2>
        <p className="import__hint">
          Выберите файл <code>.md</code> в формате <code>## 1. Тема</code> → <code>**100.** Вопрос</code> →{' '}
          <code>&gt; **Ответ**</code>. Курсив под ответом станет подсказкой для ведущего. Файл читается только на этом
          устройстве и сохраняется в закрытые данные комнаты — игроки его не увидят.
        </p>

        <label className="button button--ghost import__file">
          <FileUp size={18} />
          {fileName ?? 'Выбрать файл…'}
          <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={handleFile} className="visually-hidden" aria-label="Файл с вопросами" />
        </label>

        <details className="import__paste">
          <summary>или вставить текст вручную</summary>
          <textarea
            className="field__input"
            rows={6}
            value={sourceText}
            onChange={(event) => {
              setSourceText(event.target.value);
              setFileName(null);
            }}
            placeholder="## 1. Тема&#10;**100.** Вопрос&#10;> **Ответ.**"
          />
        </details>

        {readError && <p className="form-error">{readError}</p>}

        {pack && (
          <div className="import__summary">
            <p className="import__count">
              Найдено тем: <strong>{pack.categories.length}</strong>, вопросов: <strong>{pack.questionCount}</strong>
            </p>
            {pack.categories.length > 0 && (
              <ol className="import__categories">
                {pack.categories.map((category) => (
                  <li key={category}>{category}</li>
                ))}
              </ol>
            )}
            {pack.warnings.length > 0 && (
              <ul className="import__warnings">
                {pack.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="modal__actions">
          <button type="button" className="button button--ghost" onClick={close}>
            Отмена
          </button>
          <button
            type="button"
            className="button button--primary"
            disabled={!canImport}
            onClick={() => {
              if (pack) onImport(pack);
              close();
            }}
          >
            Заменить темы и вопросы
          </button>
        </div>
        <p className="import__note">Статусы карточек, названия команд и счёт не меняются.</p>
      </div>
    </Modal>
  );
}
