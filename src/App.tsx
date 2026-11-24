import { useCallback, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import type { GameSnapshot } from './game/types';
import { formatEarnedMoney } from './game/gameConfig';
import { shareGameResult } from './game/shareResult';

type AppPhase = 'ready' | 'playing' | 'paused' | 'gameover';

const INITIAL_SNAPSHOT: GameSnapshot = {
  delivered: 0,
  earnedKopecks: 0,
  lives: 3,
  level: 1,
  best: 0,
  targetCabinet: 1,
  targetSlot: 1,
  timeLeft: 5,
  timeLimit: 5,
};

function formatGoods(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;

  let word = 'товаров';

  if (lastTwo >= 11 && lastTwo <= 14) {
    word = 'товаров';
  } else if (last === 1) {
    word = 'товар';
  } else if (last >= 2 && last <= 4) {
    word = 'товара';
  }

  return `${count} ${word}`;
}

function App() {
  const [phase, setPhase] = useState<AppPhase>('ready');
  const [resetKey, setResetKey] = useState(0);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(INITIAL_SNAPSHOT);
  const [shareError, setShareError] = useState<string | null>(null);

  const handleSnapshot = useCallback((next: GameSnapshot) => {
    setSnapshot(next);
  }, []);

  const handleGameOver = useCallback(() => {
    setPhase('gameover');
  }, []);

  const startGame = () => {
    if (phase === 'gameover') {
      setResetKey((key) => key + 1);
      setSnapshot(INITIAL_SNAPSHOT);
    }

    setShareError(null);
    setPhase('playing');
  };

  const togglePause = () => {
    setPhase((current) =>
      current === 'playing' ? 'paused' : 'playing',
    );
  };

  const resetGame = () => {
    setResetKey((key) => key + 1);
    setSnapshot(INITIAL_SNAPSHOT);
    setShareError(null);
    setPhase('ready');
  };

  const handleShare = async () => {
    setShareError(null);

    try {
      await shareGameResult(snapshot);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      setShareError(
        'Не получилось подготовить результат. Попробуй ещё раз.',
      );
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            К
          </div>

          <div>
            <p className="eyebrow">PIXEL ARCADE · GAME 001</p>
            <h1>Коробочный переполох</h1>
            <p className="brand-description">
              Быстрее сортируй — больше зарабатывай!
            </p>
          </div>
        </div>

        <div className="topbar-note">
          <span className="status-dot" />
          СОРТИРОВОЧНАЯ № 6
        </div>
      </header>

      <section
        className="game-panel"
        aria-label="Игровое поле"
      >
        <div className="game-stage">
          <GameCanvas
            isActive={phase === 'playing'}
            resetKey={resetKey}
            onSnapshot={handleSnapshot}
            onGameOver={handleGameOver}
          />

          {phase !== 'playing' && (
            <div className="game-overlay">
              <div className="overlay-card">
                <div className="overlay-icon">
                  📦
                </div>

                <p className="eyebrow">
                  {phase === 'gameover'
                    ? 'СМЕНА ЗАВЕРШЕНА'
                    : phase === 'paused'
                      ? 'НЕБОЛЬШАЯ ПЕРЕДЫШКА'
                      : 'ДОБРО ПОЖАЛОВАТЬ'}
                </p>

                <h2>
                  {phase === 'ready' && 'Готов к работе?'}
                  {phase === 'paused' && 'Передышка'}
                  {phase === 'gameover' && 'Коробки закончились!'}
                </h2>

                <p className="overlay-copy">
                  {phase === 'ready' &&
                    'Смотри на номер коробки, находи нужный шкаф и ячейку. Не ошибайся — время ограничено!'}

                  {phase === 'paused' &&
                    'Смена приостановлена. Все коробки терпеливо ждут.'}

                  {phase === 'gameover' && (
                    <>
                      Доставлено: {formatGoods(snapshot.delivered)}.
                      <br />
                      Заработано: {formatEarnedMoney(snapshot.earnedKopecks)}.
                      <br />
                      Рекорд: {formatGoods(snapshot.best)}.
                      <br />
                      Достигнут уровень: {snapshot.level}.
                    </>
                  )}
                </p>

                <button
                  className="primary-button"
                  type="button"
                  onClick={startGame}
                >
                  {phase === 'paused'
                    ? 'Продолжить'
                    : phase === 'gameover'
                      ? 'Играть ещё раз'
                      : 'Начать смену'}
                </button>

                {phase === 'gameover' && (
                  <>
                    <button
                      className="share-button"
                      type="button"
                      onClick={handleShare}
                    >
                      ↗ Поделиться результатом
                    </button>

                    {shareError && (
                      <p className="share-error" role="alert">
                        {shareError}
                      </p>
                    )}
                  </>
                )}

                <p className="key-hint">
                  НАЖИМАЙ НА НУЖНУЮ ЯЧЕЙКУ
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="game-controls">
          {phase === 'playing' ? (
            <button
              className="secondary-button"
              type="button"
              onClick={togglePause}
            >
              Ⅱ Пауза
            </button>
          ) : phase === 'paused' ? (
            <button
              className="secondary-button"
              type="button"
              onClick={togglePause}
            >
              ▶ Продолжить
            </button>
          ) : (
            <button
              className="secondary-button"
              type="button"
              onClick={resetGame}
            >
              ↻ Сбросить
            </button>
          )}
        </div>
      </section>

      <footer className="footer-note">
        <span>PIXEL ARCADE · PIXIJS 8</span>
        <span>1 товар = 0,7 копейки</span>
      </footer>
    </main>
  );
}

export default App;