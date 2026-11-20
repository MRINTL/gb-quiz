import { useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Maximize2, Minimize2, Radio } from 'lucide-react';
import { GameBoard } from '../components/GameBoard';
import { RoomHeader } from '../components/RoomHeader';
import { FullPageMessage } from '../components/StatusViews';
import { useAnonymousUser, useRoom } from '../hooks/useRoomData';
import { useFullscreen } from '../hooks/useFullscreen';
import { isValidRoomCode } from '../services/firebaseService';
import { allCardIds, countRemainingCards, parseCardId } from '../types';

export function PlayerBoard() {
  const { roomId } = useParams<{ roomId: string }>();
  const isCodeValid = Boolean(roomId && isValidRoomCode(roomId));
  const { user, error: authError } = useAnonymousUser();
  const { room, isLoading, isNotFound, error: roomError, connection } = useRoom(isCodeValid ? roomId : undefined, user);

  const pageRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen(pageRef);

  const remainingCards = useMemo(() => (room ? countRemainingCards(room.cards) : 0), [room]);
  const openedCards = useMemo(
    () => (room ? allCardIds().filter((cardId) => room.cards[cardId] === 'opened') : []),
    [room],
  );

  const backHome = (
    <Link className="button button--primary" to="/">
      На главную
    </Link>
  );

  if (!isCodeValid || isNotFound) {
    return (
      <FullPageMessage
        tone="error"
        title="Комната не найдена"
        description="Проверьте ссылку или код комнаты у ведущего."
        actions={backHome}
      />
    );
  }
  if (authError || roomError) {
    return <FullPageMessage tone="error" title="Не удалось подключиться" description={authError ?? roomError} actions={backHome} />;
  }
  if (isLoading || !room || !roomId) return <FullPageMessage tone="loading" title="Подключаемся к игре…" />;

  const isHostBrowser = user?.uid === room.hostUid;

  return (
    <div ref={pageRef} className={`page page--player${isFullscreen ? ' page--fullscreen' : ''}`}>
      <RoomHeader roomId={roomId} remainingCards={remainingCards} connection={connection} roleLabel="Игрок" showHomeLink={false}>
        {isHostBrowser && !isFullscreen && (
          <Link to={`/host/${roomId}`} className="button button--ghost button--small">
            <Crown size={18} /> <span className="hide-on-mobile">Панель ведущего</span>
          </Link>
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
      </RoomHeader>

      <div className="now-playing-slot" aria-live="polite">
        <AnimatePresence mode="wait">
          {openedCards.length > 0 ? (
            <motion.div
              key={openedCards.join()}
              className="now-playing"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <Radio size={18} className="now-playing__icon" aria-hidden />
              <span>Разыгрывается:</span>
              {openedCards.map((cardId) => {
                const { categoryIndex, value } = parseCardId(cardId);
                return (
                  <strong key={cardId}>
                    {room.categories[categoryIndex]} — {value}
                  </strong>
                );
              })}
            </motion.div>
          ) : remainingCards === 0 ? (
            <motion.div key="finished" className="now-playing now-playing--done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              Все вопросы сыграны!
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <GameBoard categories={room.categories} cards={room.cards} />

      {!isFullscreen && (
        <ul className="legend" aria-label="Обозначения">
          <li><span className="legend__swatch legend__swatch--available" /> Доступен</li>
          <li><span className="legend__swatch legend__swatch--opened" /> Разыгрывается</li>
          <li><span className="legend__swatch legend__swatch--completed" /> Использован</li>
        </ul>
      )}
    </div>
  );
}
