import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Info, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  createRoom,
  describeError,
  forgetHostedRoom,
  formatRoomCode,
  getHostedRooms,
  type HostedRoomEntry,
} from '../services/firebaseService';
import { useAnonymousUser } from '../hooks/useRoomData';
import { loadDefaultPack } from '../services/questionPackParser';

export function AnonymousAuthNotice() {
  return (
    <div className="notice">
      <Info size={20} className="notice__icon" aria-hidden />
      <p>
        Права ведущего привязаны к этому браузеру через анонимный вход. Если вы откроете панель в другом браузере,
        в режиме инкогнито или очистите данные сайта — управлять комнатой больше не получится (игроки по-прежнему
        увидят поле). Проводите игру с того же устройства и браузера, где создали комнату.
      </p>
    </div>
  );
}

export function CreateRoom() {
  const navigate = useNavigate();
  const { user, error: authError } = useAnonymousUser();
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [hostedRooms, setHostedRooms] = useState<HostedRoomEntry[]>(() => getHostedRooms());

  const handleCreate = async (): Promise<void> => {
    setIsCreating(true);
    setCreateError(null);
    try {
      // Every new room starts with the built-in BIRTHDAY.md questions.
      const roomId = await createRoom(await loadDefaultPack());
      navigate(`/host/${roomId}`);
    } catch (error) {
      setCreateError(describeError(error));
      setIsCreating(false);
    }
  };

  const handleForget = (roomId: string): void => {
    forgetHostedRoom(roomId);
    setHostedRooms(getHostedRooms());
  };

  const visibleError = createError ?? authError;

  return (
    <main className="host-start">
      <Link to="/" className="back-link">
        <ArrowLeft size={18} /> На главную
      </Link>

      <motion.section
        className="panel panel--wide"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="panel__title panel__title--large">Панель ведущего</h1>
        <p className="panel__text">
          Создайте игровую комнату, отправьте игрокам ссылку или QR-код, задайте категории и вопросы.
        </p>
        <button
          type="button"
          className="button button--primary button--large"
          onClick={() => void handleCreate()}
          disabled={isCreating || !user}
        >
          {isCreating || !user ? <Loader2 className="spin" size={20} /> : <Plus size={20} />}
          {isCreating ? 'Создаём комнату…' : user ? 'Создать комнату' : 'Подключение…'}
        </button>
        {visibleError && <p className="form-error">{visibleError}</p>}
        <AnonymousAuthNotice />
      </motion.section>

      {hostedRooms.length > 0 && (
        <section className="panel panel--wide">
          <h2 className="panel__title">Ваши комнаты в этом браузере</h2>
          <ul className="room-list">
            {hostedRooms.map((entry) => (
              <li key={entry.id} className="room-list__item">
                <Link to={`/host/${entry.id}`} className="room-list__link">
                  <span className="room-list__code">{formatRoomCode(entry.id)}</span>
                  <span className="room-list__date">
                    {new Date(entry.createdAt).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </Link>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => handleForget(entry.id)}
                  aria-label={`Убрать комнату ${formatRoomCode(entry.id)} из списка`}
                  title="Убрать из списка"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
