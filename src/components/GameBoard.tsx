import { Fragment } from 'react';
import { CategoryHeader } from './CategoryHeader';
import { QuestionCard } from './QuestionCard';
import {
  CARD_VALUES,
  CATEGORY_COUNT,
  makeCardId,
  type CardId,
  type AwardMap,
  type CardStatusMap,
  type QuestionMap,
} from '../types';

interface GameBoardProps {
  categories: string[];
  cards: CardStatusMap;
  /** Host only. When absent the board is read-only. */
  questions?: QuestionMap;
  /** Host only. Shows which team got each completed card. */
  awards?: AwardMap;
  isEditMode?: boolean;
  onCardSelect?: (cardId: CardId) => void;
  onRenameCategory?: (categoryIndex: number, newName: string) => void;
}

const CATEGORY_INDEXES = Array.from({ length: CATEGORY_COUNT }, (_, index) => index);

export function GameBoard({
  categories,
  cards,
  questions,
  awards,
  isEditMode = false,
  onCardSelect,
  onRenameCategory,
}: GameBoardProps) {
  return (
    <div className="board-scroll">
      <div className="board" role="group" aria-label="Игровое поле">
        {/* One row per category: name on the left, values 100 → 600 to the right. */}
        {CATEGORY_INDEXES.map((categoryIndex) => (
          <Fragment key={categoryIndex}>
            <CategoryHeader
              categoryIndex={categoryIndex}
              name={categories[categoryIndex] ?? ''}
              isEditable={isEditMode && Boolean(onRenameCategory)}
              onRename={onRenameCategory}
            />
            {CARD_VALUES.map((value) => {
              const cardId = makeCardId(categoryIndex, value);
              return (
                <QuestionCard
                  key={cardId}
                  value={value}
                  status={cards[cardId] ?? 'available'}
                  categoryName={categories[categoryIndex] ?? ''}
                  hasQuestion={questions ? Boolean(questions[cardId]?.question) : undefined}
                  isEditMode={isEditMode}
                  awardedTeam={awards?.[cardId]}
                  onSelect={onCardSelect ? () => onCardSelect(cardId) : undefined}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
