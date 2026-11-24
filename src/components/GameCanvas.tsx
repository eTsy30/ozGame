
import { useEffect, useRef } from 'react';
import { SortingGame } from '../game/SortingGame';
import type { GameSnapshot } from '../game/types';

type GameCanvasProps = {
  isActive: boolean;
  resetKey: number;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onGameOver: () => void;
};

export function GameCanvas({
  isActive,
  resetKey,
  onSnapshot,
  onGameOver,
}: GameCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<SortingGame | null>(null);
  const isActiveRef = useRef(isActive);

  const callbacksRef = useRef({
    onSnapshot,
    onGameOver,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSnapshot,
      onGameOver,
    };
  }, [onSnapshot, onGameOver]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);


useEffect(() => {
  const host = hostRef.current;
  if (!host) return;

  let cancelled = false;
  let resizeObserver: ResizeObserver | null = null;

  const game = new SortingGame(host, {
    onSnapshot: (snapshot) =>
      callbacksRef.current.onSnapshot(snapshot),

    onGameOver: () =>
      callbacksRef.current.onGameOver(),
  });

  void game
    .init()
    .then(() => {
      if (cancelled) {
        game.destroy();
        return;
      }

      gameRef.current = game;
      game.setRunning(isActiveRef.current);

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;

        const width = Math.floor(entry.contentRect.width);

        if (width > 0) {
          game.resize(width);
        }
      });

      resizeObserver.observe(host);
    })
    .catch((error: unknown) => {
      if (!cancelled) {
        console.error(
          'Не удалось инициализировать PixiJS:',
          error,
        );
      }
    });

  return () => {
    cancelled = true;

    resizeObserver?.disconnect();

    // Уничтожаем только уже инициализированную игру.
    if (gameRef.current === game) {
      game.destroy();
      gameRef.current = null;
    }
  };
}, []);


  useEffect(() => {
    gameRef.current?.setRunning(isActive);
  }, [isActive]);

  useEffect(() => {
    if (resetKey > 0 && gameRef.current) {
      gameRef.current.reset();
      gameRef.current.setRunning(isActiveRef.current);
    }
  }, [resetKey]);

  return (
    <div
      className="pixi-host"
      ref={hostRef}
      style={{
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
      }}
    />
  );
}
