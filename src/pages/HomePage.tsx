import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Crown, Users } from 'lucide-react';
import { isValidRoomCode, normalizeRoomCode } from '../services/firebaseService';

export function HomePage() {
  const navigate = useNavigate();
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  const handleJoin = (event: FormEvent): void => {
    event.preventDefault();
    const code = normalizeRoomCode(codeInput);
    if (!isValidRoomCode(code)) {
      setCodeError('Код комнаты — 12 символов, например ABCD-EFGH-JKMN.');
      return;
    }
    navigate(`/room/${code}`);
  };

  return (
    <main className="home">
      <motion.section
        className="home__hero"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="logo logo--large">
          <span className="logo__mark">HB</span>
        </span>
        <h1 className="home__title">HB Quiz</h1>
        <p className="home__subtitle">Живое игровое поле для офлайн-квиза: 6 категорий, 36 вопросов, мгновенная синхронизация.</p>
      </motion.section>

      <div className="home__cards">
        <motion.div
          className="panel"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          <Crown className="panel__icon" size={28} aria-hidden />
          <h2 className="panel__title">Я ведущий</h2>
          <p className="panel__text">Создайте комнату, заполните вопросы и управляйте полем с ноутбука.</p>
          <Link to="/host" className="button button--primary button--block">
            Панель ведущего <ArrowRight size={18} />
          </Link>
        </motion.div>

        <motion.form
          className="panel"
          onSubmit={handleJoin}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16 }}
        >
          <Users className="panel__icon" size={28} aria-hidden />
          <h2 className="panel__title">Я игрок</h2>
          <label className="field">
            <span className="field__label">Код комнаты или ссылка</span>
            <input
              className="field__input field__input--code"
              value={codeInput}
              onChange={(event) => {
                setCodeInput(event.target.value);
                setCodeError(null);
              }}
              placeholder="ABCD-EFGH-JKMN"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {codeError && <p className="form-error">{codeError}</p>}
          <button type="submit" className="button button--primary button--block">
            Войти в комнату <ArrowRight size={18} />
          </button>
        </motion.form>
      </div>
    </main>
  );
}
