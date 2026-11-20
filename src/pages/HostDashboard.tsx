import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Maximize2, Minimize2, QrCode, RotateCcw, X } from 'lucide-react';
import { GameBoard } from '../components/GameBoard';
import { Scoreboard } from '../components/Scoreboard';
import { QuestionModal } from '../components/QuestionModal';
import { RoomHeader } from '../components/RoomHeader';
import { ConfirmDialog } from '../components/Dialogs';
import { ImportDialog } from '../components/ImportDialog';
import { ShareRoomDialog } from '../components/ShareRoomDialog';
import { FullPageMessage, Toast, useToast } from '../components/StatusViews';
import { AnonymousAuthNotice } from './CreateRoom';
import { useAnonymousUser, useHostContent, useRoom } from '../hooks/useRoomData';
import { useFullscreen } from '../hooks/useFullscreen';
import type { ParsedQuestionPack } from '../services/questionPackParser';
import {
  describeError,
  importQuestionPack,
  renameCategory,
  renameTeam,
  resetBoard,
  saveQuestion,
  setCardAward,
  setCardStatus,
} from '../services/firebaseService';
import {
  allCardIds,
  computeScores,
  countRemainingCards,
  parseCardId,
  type CardId,
  type CardStatus,
  type QuestionContent,
  type TeamIndex,
} from '../types';

const AUTH_NOTICE_KEY = 'brainquiz.authNoticeDismissed';

function readNoticeDismissed(): boolean {
  try {
    return localStorage.getItem(AUTH_NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}

export function HostDashboard() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user, error: authError } = useAnonymousUser();
  const { room, isLoading, isNotFound, error: roomError, connection } = useRoom(roomId, user);
  const isHost = Boolean(room && user && room.hostUid === user.uid);
  const { content: hostContent, error: questionsError } = useHostContent(roomId, isHost);
  const { questions, teamNames, awards } = hostContent;

  const [selectedCardId, setSelectedCardId] = useState<CardId | null>(null);
  const [isQuestionOpen, setIsQuestionOpen] = useState(false);
  const [modalStartsInEdit, setModalStartsInEdit] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isNoticeDismissed, setIsNoticeDismissed] = useState(readNoticeDismissed);

  const pageRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen(pageRef);
  const { toast, showToast } = useToast();

  /**
   * Firestore applies writes locally at once (all listeners update immediately) and the promise
   * resolves only after the server confirms, so we never block the UI on it — we only report errors.
   */
  const runWrite = useCallback(
    (write: Promise<void>, successText?: string) => {
      write.then(() => successText && showToast(successText)).catch((error: unknown) => showToast(describeError(error), 'error'));
    },
    [showToast],
  );

  const remainingCards = useMemo(() => (room ? countRemainingCards(room.cards) : 0), [room]);
  const scores = useMemo(() => computeScores(awards), [awards]);

  if (authError) return <FullPageMessage tone="error" title="Не удалось войти" description={authError} />;
  if (roomError) {
    return (
      <FullPageMessage
        tone="error"
        title="Ошибка загрузки комнаты"
        description={roomError}
        actions={<Link className="button button--primary" to="/host">К списку комнат</Link>}
      />
    );
  }
  if (isNotFound) {
    return (
      <FullPageMessage
        tone="error"
        title="Комната не найдена"
        description="Возможно, ссылка содержит ошибку или комната была удалена."
        actions={<Link className="button button--primary" to="/host">Создать новую</Link>}
      />
    );
  }
  if (isLoading || !room || !roomId) return <FullPageMessage tone="loading" title="Загружаем комнату…" />;

  if (!isHost) {
    return (
      <FullPageMessage
        tone="error"
        title="Вы не ведущий этой комнаты"
        description={
          <>
            Комната была создана в другом браузере или данные этого браузера были очищены. Анонимный вход не позволяет
            восстановить права ведущего — создайте новую комнату или откройте поле как игрок.
          </>
        }
        actions={
          <>
            <Link className="button button--ghost" to={`/room/${roomId}`}>Открыть как игрок</Link>
            <Link className="button button--primary" to="/host">Новая комната</Link>
          </>
        }
      />
    );
  }

  const selectedPosition = selectedCardId ? parseCardId(selectedCardId) : null;

  const openCard = (cardId: CardId): void => {
    if (isEditMode) {
      setModalStartsInEdit(true);
    } else {
      setModalStartsInEdit(false);
      if (room.cards[cardId] === 'available') runWrite(setCardStatus(roomId, cardId, 'opened'));
    }
    setSelectedCardId(cardId);
    setIsQuestionOpen(true);
  };

  const closeQuestion = (): void => setIsQuestionOpen(false);

  const handleChangeStatus = (status: CardStatus): void => {
    if (!selectedCardId) return;
    runWrite(setCardStatus(roomId, selectedCardId, status));
    // Back to available = the question was never played, so its points are taken back.
    if (status === 'available' && awards[selectedCardId] !== undefined) {
      runWrite(setCardAward(roomId, selectedCardId, null));
    }
    if (status !== 'opened') closeQuestion();
  };

  const handleAward = (teamIndex: TeamIndex | null): void => {
    if (!selectedCardId) return;
    const wasOpened = room.cards[selectedCardId] === 'opened';
    runWrite(setCardAward(roomId, selectedCardId, teamIndex));
    if (wasOpened) {
      runWrite(setCardStatus(roomId, selectedCardId, 'completed'));
      closeQuestion();
    }
    const position = parseCardId(selectedCardId);
    showToast(
      teamIndex === null
        ? 'Вопрос закрыт без очков'
        : `+${position.value} — ${teamNames[teamIndex] || `Команда ${teamIndex + 1}`}`,
    );
  };

  const handleRenameTeam = (teamIndex: TeamIndex, newName: string): void => {
    runWrite(renameTeam(roomId, teamNames, teamIndex, newName), 'Команда переименована');
  };

  const handleSave = async (content: QuestionContent): Promise<void> => {
    if (selectedCardId) runWrite(saveQuestion(roomId, selectedCardId, content), 'Вопрос сохранён');
  };

  const handleSaveAndNext = async (content: QuestionContent): Promise<void> => {
    if (!selectedCardId) return;
    runWrite(saveQuestion(roomId, selectedCardId, content));
    const ids = allCardIds();
    const nextId = ids[ids.indexOf(selectedCardId) + 1];
    if (nextId) setSelectedCardId(nextId);
    else closeQuestion();
  };

  const handleRenameCategory = (categoryIndex: number, newName: string): void => {
    runWrite(renameCategory(roomId, room.categories, categoryIndex, newName), 'Категория переименована');
  };

  const handleImport = (pack: ParsedQuestionPack): void => {
    runWrite(
      importQuestionPack(roomId, { categories: room.categories, questions }, pack),
      `Импортировано: ${pack.categories.length} тем, ${pack.questionCount} вопросов`,
    );
  };

  const handleReset = (): void => {
    runWrite(resetBoard(roomId), 'Поле сброшено');
    setIsResetOpen(false);
  };

  const dismissNotice = (): void => {
    setIsNoticeDismissed(true);
    try {
      localStorage.setItem(AUTH_NOTICE_KEY, '1');
    } catch {
      // Storage unavailable — the notice will simply appear again next time.
    }
  };

  return (
    <div ref={pageRef} className={`page page--host${isFullscreen ? ' page--fullscreen' : ''}`}>
      <RoomHeader roomId={roomId} remainingCards={remainingCards} connection={connection} roleLabel="Ведущий">
        {!isFullscreen && (
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => setIsShareOpen(true)}
            aria-label="QR-код и подготовка игры"
            title="QR-код, ссылка, импорт и редактирование"
          >
            <QrCode size={18} /> <span className="hide-on-mobile">QR-код</span>
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полный экран'}
          title={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полный экран'}
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
        {!isFullscreen && (
          // Pushed to the far right, away from the other buttons, so it isn't hit by accident.
          <button
            type="button"
            className="button button--ghost button--small room-header__danger"
            onClick={() => setIsResetOpen(true)}
            aria-label="Сбросить поле"
            title="Сбросить поле"
          >
            <RotateCcw size={18} /> <span className="hide-on-mobile">Сброс</span>
          </button>
        )}
      </RoomHeader>

      {!isFullscreen && !isNoticeDismissed && (
        <div className="host-notice">
          <AnonymousAuthNotice />
          <button type="button" className="icon-button" onClick={dismissNotice} aria-label="Скрыть предупреждение">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Hidden in fullscreen: that view is meant for the TV/projector everyone can see. */}
      {!isFullscreen && <Scoreboard teamNames={teamNames} scores={scores} onRenameTeam={handleRenameTeam} />}

      {isEditMode && !isFullscreen && (
        <div className="edit-hint">
          <p>
            Режим редактирования: переименуйте категории прямо в заголовках, нажмите на карточку, чтобы добавить вопрос
            и ответ. Статусы карточек при этом не меняются.
          </p>
          <button type="button" className="button button--primary button--small" onClick={() => setIsEditMode(false)}>
            <Check size={18} /> Готово
          </button>
        </div>
      )}
      {questionsError && <p className="form-error">{questionsError}</p>}

      <GameBoard
        categories={room.categories}
        cards={room.cards}
        questions={questions}
        awards={isFullscreen ? undefined : awards}
        isEditMode={isEditMode}
        onCardSelect={openCard}
        onRenameCategory={handleRenameCategory}
      />

      {selectedCardId && selectedPosition && (
        <QuestionModal
          key={selectedCardId}
          isOpen={isQuestionOpen}
          categoryName={room.categories[selectedPosition.categoryIndex] ?? ''}
          value={selectedPosition.value}
          status={room.cards[selectedCardId] ?? 'available'}
          content={questions[selectedCardId]}
          startInEditMode={modalStartsInEdit}
          teamNames={teamNames}
          awardedTeam={awards[selectedCardId]}
          onClose={closeQuestion}
          onAward={handleAward}
          onChangeStatus={handleChangeStatus}
          onSave={handleSave}
          onSaveAndNext={isEditMode ? handleSaveAndNext : undefined}
        />
      )}

      <ImportDialog isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onImport={handleImport} />
      <ShareRoomDialog
        roomId={roomId}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        isEditMode={isEditMode}
        onOpenImport={() => {
          setIsShareOpen(false);
          setIsImportOpen(true);
        }}
        onToggleEditMode={() => {
          setIsShareOpen(false);
          setIsEditMode((editing) => !editing);
        }}
      />
      <ConfirmDialog
        isOpen={isResetOpen}
        title="Сбросить игровое поле?"
        message="Все 36 карточек снова станут доступными у всех игроков, счёт обеих команд обнулится. Категории, названия команд, вопросы и ответы сохранятся."
        confirmLabel="Сбросить поле"
        onConfirm={handleReset}
        onCancel={() => setIsResetOpen(false)}
      />
      <Toast toast={toast} />
    </div>
  );
}
