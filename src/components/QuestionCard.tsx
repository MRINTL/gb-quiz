import { motion } from 'framer-motion';
import { Check, PencilLine } from 'lucide-react';
import type { CardStatus, CardValue, TeamIndex } from '../types';

interface QuestionCardProps {
  value: CardValue;
  status: CardStatus;
  categoryName: string;
  /** Host only: whether a question text has been written for this card. */
  hasQuestion?: boolean;
  isEditMode?: boolean;
  /** Host only: team that got this card's points. */
  awardedTeam?: TeamIndex;
  onSelect?: () => void;
}

const STATUS_LABEL: Record<CardStatus, string> = {
  available: 'доступен',
  opened: 'открыт',
  completed: 'использован',
};

export function QuestionCard({
  value,
  status,
  categoryName,
  hasQuestion,
  isEditMode,
  awardedTeam,
  onSelect,
}: QuestionCardProps) {
  const isInteractive = Boolean(onSelect);
  // Only in edit mode: during the game the pencils would just clutter the board.
  const showMissingHint = isInteractive && isEditMode && hasQuestion === false;

  return (
    <motion.button
      type="button"
      layout
      className={`question-card question-card--${status}${isInteractive ? ' question-card--interactive' : ''}${
        isEditMode ? ' question-card--edit' : ''
      }`}
      disabled={!isInteractive}
      onClick={onSelect}
      aria-label={`${categoryName}, ${value} — ${STATUS_LABEL[status]}`}
      initial={false}
      animate={{
        opacity: status === 'completed' ? 0.42 : 1,
        scale: status === 'opened' ? 1.03 : 1,
      }}
      whileHover={isInteractive ? { y: -3 } : undefined}
      whileTap={isInteractive ? { scale: 0.96 } : undefined}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
    >
      <span className="question-card__value">{value}</span>
      {status === 'completed' && (
        <motion.span
          className="question-card__strike"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          aria-hidden
        />
      )}
      {status === 'opened' && <span className="question-card__pulse" aria-hidden />}
      {status === 'completed' && awardedTeam !== undefined && (
        <span className={`question-card__team question-card__team--${awardedTeam}`} aria-hidden>
          {awardedTeam + 1}
        </span>
      )}
      {isInteractive && hasQuestion && isEditMode && <Check className="question-card__badge" aria-hidden />}
      {showMissingHint && <PencilLine className="question-card__badge question-card__badge--missing" aria-hidden />}
    </motion.button>
  );
}
