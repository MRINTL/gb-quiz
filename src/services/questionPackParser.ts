import {
  CARD_VALUES,
  CATEGORY_COUNT,
  MAX_CATEGORY_NAME_LENGTH,
  makeCardId,
  type CardValue,
  type QuestionMap,
} from '../types';

/**
 * Parses a question pack written in Markdown:
 *
 *   ## 1. Category name
 *   **100.** Question text, may span
 *   several lines.
 *   > **Answer.**
 *   > *Reasoning / hint for the host, may span lines.*
 *
 * Everything else (intro, category descriptions, "**Как читать:**" notes, "## Как это провести")
 * is ignored. Only categories whose header starts with a number are imported, in file order.
 */
export interface ParsedQuestionPack {
  categories: string[];
  questions: QuestionMap;
  questionCount: number;
  warnings: string[];
}

const CATEGORY_HEADER = /^##\s+\d+[.)]\s*(.+)$/;
const QUESTION_START = /^\*\*(\d{3})\.\*\*\s*(.*)$/;

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function stripMarkdown(text: string): string {
  // Italic segments are already extracted before this runs, so any remaining asterisks are formatting.
  return text.replace(/\*+/g, '').trim();
}

/** Splits a "> ..." block into the answer itself and the italic reasoning paragraphs. */
function splitAnswerBlock(blockLines: string[]): string {
  const text = blockLines.join('\n');
  const reasoning: string[] = [];
  // Italic = single asterisks that are not part of "**bold**".
  const withoutItalic = text.replace(/(?<!\*)\*(?!\*)([\s\S]+?)(?<!\*)\*(?!\*)/g, (_, inner: string) => {
    reasoning.push(collapseWhitespace(inner));
    return ' ';
  });
  const answer = collapseWhitespace(stripMarkdown(withoutItalic));
  return reasoning.length > 0 ? `${answer}\n\n${reasoning.join('\n\n')}` : answer;
}

export function parseQuestionPack(markdown: string): ParsedQuestionPack {
  const categories: string[] = [];
  const questions: QuestionMap = {};
  const warnings: string[] = [];
  let questionCount = 0;

  let categoryIndex = -1;
  let currentValue: CardValue | null = null;
  let questionLines: string[] = [];
  let answerLines: string[] = [];

  const flush = (): void => {
    if (categoryIndex < 0 || categoryIndex >= CATEGORY_COUNT || currentValue === null) return;
    const question = collapseWhitespace(stripMarkdown(questionLines.join(' ')));
    const answer = splitAnswerBlock(answerLines);
    const cardId = makeCardId(categoryIndex, currentValue);
    if (questions[cardId]) warnings.push(`«${categories[categoryIndex]}» — ${currentValue}: номинал повторяется, взят последний.`);
    else questionCount += 1;
    questions[cardId] = { question, answer };
    if (!answer) warnings.push(`«${categories[categoryIndex]}» — ${currentValue}: не найден ответ.`);
    currentValue = null;
    questionLines = [];
    answerLines = [];
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.startsWith('## ')) {
      flush();
      const header = line.match(CATEGORY_HEADER);
      if (header?.[1]) {
        categoryIndex = categories.length;
        categories.push(collapseWhitespace(stripMarkdown(header[1])).slice(0, MAX_CATEGORY_NAME_LENGTH));
      } else {
        categoryIndex = -1; // e.g. "## Как это провести"
      }
      continue;
    }

    const questionStart = line.match(QUESTION_START);
    if (questionStart) {
      flush();
      const value = Number(questionStart[1]) as CardValue;
      if (!CARD_VALUES.includes(value)) {
        warnings.push(`Номинал ${questionStart[1]} не поддерживается — пропущен.`);
        continue;
      }
      currentValue = value;
      questionLines = [questionStart[2] ?? ''];
      continue;
    }

    if (currentValue === null) continue;

    if (line.startsWith('>')) {
      answerLines.push(line.replace(/^>\s?/, ''));
    } else if (line === '---' || (answerLines.length > 0 && line === '')) {
      flush();
    } else if (answerLines.length === 0 && line !== '') {
      questionLines.push(line);
    } else if (answerLines.length > 0) {
      // Plain text right after the answer (e.g. "**В запасе,** ...") is not part of this card.
      flush();
    }
  }
  flush();

  if (categories.length > CATEGORY_COUNT) {
    warnings.push(`В файле ${categories.length} тем, импортированы первые ${CATEGORY_COUNT}.`);
  }
  if (categories.length < CATEGORY_COUNT) {
    warnings.push(`Найдено тем: ${categories.length} из ${CATEGORY_COUNT}. Остальные останутся как были.`);
  }

  return { categories: categories.slice(0, CATEGORY_COUNT), questions, questionCount, warnings };
}

/**
 * The game's built-in question set (BIRTHDAY.md in the project root).
 *
 * Loaded with a dynamic import, so Vite puts it into a separate file that is fetched only when the host
 * creates a room (after the host password). Players never download it during the game. It is still a
 * public static file of the site, so this keeps answers out of sight, not cryptographically secret.
 */
export async function loadDefaultPack(): Promise<ParsedQuestionPack> {
  const { default: markdown } = await import('../../BIRTHDAY.md?raw');
  return parseQuestionPack(markdown);
}
