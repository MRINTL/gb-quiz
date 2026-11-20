export const CATEGORY_COUNT = 6;
export const CARD_VALUES = [100, 200, 300, 400, 500, 600] as const;
export const TOTAL_CARDS = CATEGORY_COUNT * CARD_VALUES.length;
export const MAX_CATEGORY_NAME_LENGTH = 60;

export type CardValue = (typeof CARD_VALUES)[number];
export type CardStatus = 'available' | 'opened' | 'completed';

/** Stable card key, e.g. "c2_300" = third category, value 300. */
export type CardId = `c${number}_${CardValue}`;

export type CardStatusMap = Record<CardId, CardStatus>;

/** Public room document: readable by every signed-in player. Never contains questions or answers. */
export interface RoomState {
  id: string;
  hostUid: string;
  categories: string[];
  cards: CardStatusMap;
}

export interface QuestionContent {
  question: string;
  answer: string;
}

/** Private host-only document with questions and answers. */
export type QuestionMap = Partial<Record<CardId, QuestionContent>>;

export const TEAM_COUNT = 2;
export const MAX_TEAM_NAME_LENGTH = 40;
export const DEFAULT_TEAM_NAMES = ['Команда 1', 'Команда 2'];
export type TeamIndex = 0 | 1;

/** Which team got the points for each completed card. Host-only. */
export type AwardMap = Partial<Record<CardId, TeamIndex>>;

/** Everything in the private host document. Players can never read it. */
export interface HostContent {
  questions: QuestionMap;
  teamNames: string[];
  awards: AwardMap;
}

export function isTeamIndex(value: unknown): value is TeamIndex {
  return value === 0 || value === 1;
}

/** Score = sum of card values awarded to the team. */
export function computeScores(awards: AwardMap): number[] {
  const scores = Array.from({ length: TEAM_COUNT }, () => 0);
  for (const [cardId, teamIndex] of Object.entries(awards)) {
    if (isTeamIndex(teamIndex)) scores[teamIndex] = (scores[teamIndex] ?? 0) + parseCardId(cardId as CardId).value;
  }
  return scores;
}

export interface CardPosition {
  categoryIndex: number;
  value: CardValue;
}

export type ConnectionStatus = 'online' | 'syncing' | 'offline';

export function makeCardId(categoryIndex: number, value: CardValue): CardId {
  return `c${categoryIndex}_${value}`;
}

export function parseCardId(cardId: CardId): CardPosition {
  const [categoryPart, valuePart] = cardId.split('_');
  return {
    categoryIndex: Number(categoryPart?.slice(1)),
    value: Number(valuePart) as CardValue,
  };
}

export function allCardIds(): CardId[] {
  const ids: CardId[] = [];
  for (let categoryIndex = 0; categoryIndex < CATEGORY_COUNT; categoryIndex += 1) {
    for (const value of CARD_VALUES) ids.push(makeCardId(categoryIndex, value));
  }
  return ids;
}

export function countRemainingCards(cards: CardStatusMap): number {
  return allCardIds().filter((id) => cards[id] !== 'completed').length;
}
