import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Ban, Eye, EyeOff, Pencil, PlayCircle, RotateCcw, Undo2 } from 'lucide-react';
import { Modal } from './Dialogs';
import type { CardStatus, CardValue, QuestionContent, TeamIndex } from '../types';

interface QuestionModalProps {
  isOpen: boolean;
  categoryName: string;
  value: CardValue;
  status: CardStatus;
  content: QuestionContent | undefined;
  startInEditMode: boolean;
  teamNames: string[];
  /** Team that got this card's points (completed cards only). */
  awardedTeam: TeamIndex | undefined;
  onClose: () => void;
  /** Opened card: complete it and give points. Completed card: change who got the points. */
  onAward: (teamIndex: TeamIndex | null) => void;
  onChangeStatus: (status: CardStatus) => void;
  onSave: (content: QuestionContent) => Promise<void>;
  /** Saves and jumps to the next card (edit flow). */
  onSaveAndNext?: (content: QuestionContent) => Promise<void>;
}

const STATUS_TEXT: Record<CardStatus, string> = {
  available: 'Доступен',
  opened: 'Открыт',
  completed: 'Использован',
};

export function QuestionModal({
  isOpen,
  categoryName,
  value,
  status,
  content,
  startInEditMode,
  teamNames,
  awardedTeam,
  onClose,
  onAward,
  onChangeStatus,
  onSave,
  onSaveAndNext,
}: QuestionModalProps) {
  const hasQuestion = Boolean(content?.question);
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [draft, setDraft] = useState<QuestionContent>({ question: '', answer: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Reset local state whenever another card is shown.
  useEffect(() => {
    if (!isOpen) return;
    setIsEditing(startInEditMode);
    setIsAnswerVisible(false);
    setDraft({ question: content?.question ?? '', answer: content?.answer ?? '' });
    // Intentionally not depending on `content`: remote updates must not wipe the host's unsaved draft.
  }, [isOpen, startInEditMode]);

  const runSave = async (saver: (draftContent: QuestionContent) => Promise<void>): Promise<void> => {
    setIsSaving(true);
    try {
      await saver(draft);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    await runSave(onSave);
    setIsEditing(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} labelledBy="question-title" size="large">
      <div className="question-modal">
        <div className="question-modal__meta">
          <span className="chip chip--accent">{categoryName || 'Категория'}</span>
          <span className="question-modal__value">{value}</span>
          <span className={`chip chip--status chip--${status}`}>{STATUS_TEXT[status]}</span>
        </div>

        {isEditing ? (
          <form
            className="question-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <h2 id="question-title" className="visually-hidden">
              Редактирование вопроса
            </h2>
            <label className="field">
              <span className="field__label">Вопрос</span>
              <textarea
                className="field__input field__input--question"
                value={draft.question}
                onChange={(event) => setDraft({ ...draft, question: event.target.value })}
                placeholder="Текст вопроса, который вы зачитаете вслух"
                rows={4}
                maxLength={2000}
                autoFocus
              />
            </label>
            <label className="field">
              <span className="field__label">Правильный ответ</span>
              <textarea
                className="field__input"
                value={draft.answer}
                onChange={(event) => setDraft({ ...draft, answer: event.target.value })}
                placeholder="Виден только вам"
                rows={2}
                maxLength={3000}
              />
            </label>
            <div className="modal__actions">
              {!startInEditMode && (
                <button type="button" className="button button--ghost" onClick={() => setIsEditing(false)}>
                  Отмена
                </button>
              )}
              {onSaveAndNext && (
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={isSaving}
                  onClick={() => void runSave(onSaveAndNext)}
                >
                  Сохранить и далее <ArrowRight size={18} />
                </button>
              )}
              <button type="submit" className="button button--primary" disabled={isSaving}>
                {isSaving ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {hasQuestion ? (
              <h2 id="question-title" className="question-modal__question">
                {content?.question}
              </h2>
            ) : (
              <div className="question-modal__empty">
                <h2 id="question-title" className="question-modal__empty-title">
                  Текст вопроса не добавлен
                </h2>
                <button type="button" className="button button--ghost" onClick={() => setIsEditing(true)}>
                  <Pencil size={18} /> Добавить вопрос
                </button>
              </div>
            )}

            {hasQuestion && (
            <div className="answer">
              <button
                type="button"
                className="button button--ghost answer__toggle"
                onClick={() => setIsAnswerVisible((visible) => !visible)}
                aria-expanded={isAnswerVisible}
              >
                {isAnswerVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                {isAnswerVisible ? 'Скрыть ответ' : 'Показать ответ'}
              </button>
              <AnimatePresence initial={false}>
                {isAnswerVisible && (
                  <motion.div
                    className="answer__text"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="answer__inner">{content?.answer || 'Ответ не указан'}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            )}

            {status !== 'available' && (
              <div className="award">
                <span className="award__label">
                  {status === 'opened' ? 'Кому засчитать?' : 'Засчитано (можно изменить):'}
                </span>
                <div className="award__buttons">
                  {teamNames.map((teamName, index) => {
                    const teamIndex = index as TeamIndex;
                    const isSelected = status === 'completed' && awardedTeam === teamIndex;
                    return (
                      <button
                        key={teamIndex}
                        type="button"
                        className={`button award__team award__team--${teamIndex}${isSelected ? ' is-selected' : ''}`}
                        aria-pressed={status === 'completed' ? isSelected : undefined}
                        onClick={() => onAward(teamIndex)}
                      >
                        <span className="award__team-name">{teamName || `Команда ${teamIndex + 1}`}</span>
                        <span className="award__points">+{value}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`button button--ghost award__none${
                      status === 'completed' && awardedTeam === undefined ? ' is-selected' : ''
                    }`}
                    aria-pressed={status === 'completed' ? awardedTeam === undefined : undefined}
                    onClick={() => onAward(null)}
                  >
                    <Ban size={18} /> Никому
                  </button>
                </div>
              </div>
            )}

            <div className="modal__actions modal__actions--spread">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setIsEditing(true)}
                aria-label="Редактировать вопрос"
              >
                <Pencil size={18} /> <span className="hide-on-mobile">Редактировать</span>
              </button>
              <div className="modal__actions">
                {status !== 'available' && (
                  <button type="button" className="button button--ghost" onClick={() => onChangeStatus('available')}>
                    <Undo2 size={18} /> Вернуть в доступные
                  </button>
                )}
                {status === 'available' && (
                  <button type="button" className="button button--primary" onClick={() => onChangeStatus('opened')}>
                    <PlayCircle size={18} /> Открыть вопрос
                  </button>
                )}
                {status === 'completed' && (
                  <button type="button" className="button button--ghost" onClick={() => onChangeStatus('opened')}>
                    <RotateCcw size={18} /> Открыть снова
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
