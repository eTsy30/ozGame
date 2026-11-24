export type GameSnapshot = {
  delivered: number;
  earnedKopecks: number;
  lives: number;
  level: number;
  best: number;

  targetCabinet: number;
  targetSlot: number;

  timeLeft: number;
  timeLimit: number;
};

export type GameCallbacks = {
  onSnapshot: (snapshot: GameSnapshot) => void;
  onGameOver: () => void;
};