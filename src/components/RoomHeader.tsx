import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ConnectionBadge } from './StatusViews';
import { formatRoomCode } from '../services/firebaseService';
import { TOTAL_CARDS, type ConnectionStatus } from '../types';

interface RoomHeaderProps {
  roomId: string;
  remainingCards: number;
  connection: ConnectionStatus;
  roleLabel: string;
  /** Show the HB logo linking to the home page. Players don't get it: they have nowhere to go from the board. */
  showHomeLink?: boolean;
  children?: ReactNode;
}

export function RoomHeader({
  roomId,
  remainingCards,
  connection,
  roleLabel,
  showHomeLink = true,
  children,
}: RoomHeaderProps) {
  return (
    <header className="room-header">
      <div className="room-header__brand">
        {showHomeLink && (
          <Link to="/" className="logo" aria-label="HB Quiz — на главную">
            <span className="logo__mark">HB</span>
            <span className="logo__text">HB Quiz</span>
          </Link>
        )}
        <span className="room-header__role">{roleLabel}</span>
      </div>

      <div className="room-header__meta">
        <span className="room-header__code" title="Код комнаты">
          {formatRoomCode(roomId)}
        </span>
        <span className="counter" aria-label={`Осталось вопросов: ${remainingCards} из ${TOTAL_CARDS}`}>
          <strong>{remainingCards}</strong>
          <span className="counter__total">/ {TOTAL_CARDS}</span>
        </span>
        <ConnectionBadge status={connection} />
      </div>

      {children && <div className="room-header__actions">{children}</div>}
    </header>
  );
}
