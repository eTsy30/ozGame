export const GAME_CONFIG = {
  cabinetCount: 6,
  cabinetColumns: 3,
  slotsPerCabinet: 12,
  gridColumns: 4,
  gridRows: 3,

  startingLives: 3,

  // Экономика
  kopecksPerDelivery: 0.7,

  // Время первых пяти уровней
 levelDurationSeconds: 30,

  // Время на одну коробку
  baseDeliveryTimeSeconds: 5,

  // Бесконечный шестой уровень
  level6BaseDeliveryTimeSeconds: 4.5,
  level6SpeedUpEveryDeliveries: 5,
  level6DeliveryTimeDecreasePerStep: 0.2,
  minimumDeliveryTimeSeconds: 1,

  // Скорость появления следующей коробки
  nextOrderDelaySeconds: 0.2,
  level6NextOrderDelayDecreasePerStep: 0.02,
  minimumNextOrderDelaySeconds: 0.05,

  // Анимации
  throwDurationSeconds: 0.42,
  dropDurationSeconds: 0.38,
} as const;

export function getDeliveryTimeForLevel(
  level: number,
  endlessDelivered = 0,
) {
  if (level < 6) {
    return GAME_CONFIG.baseDeliveryTimeSeconds;
  }

  const steps = Math.floor(
    endlessDelivered / GAME_CONFIG.level6SpeedUpEveryDeliveries,
  );

  return Math.max(
    GAME_CONFIG.minimumDeliveryTimeSeconds,
    GAME_CONFIG.level6BaseDeliveryTimeSeconds -
      steps * GAME_CONFIG.level6DeliveryTimeDecreasePerStep,
  );
}

export function getNextOrderDelay(
  level: number,
  endlessDelivered = 0,
) {
  if (level < 6) {
    return GAME_CONFIG.nextOrderDelaySeconds;
  }

  const steps = Math.floor(
    endlessDelivered / GAME_CONFIG.level6SpeedUpEveryDeliveries,
  );

  return Math.max(
    GAME_CONFIG.minimumNextOrderDelaySeconds,
    GAME_CONFIG.nextOrderDelaySeconds -
      steps * GAME_CONFIG.level6NextOrderDelayDecreasePerStep,
  );
}

export function getEarnedKopecks(delivered: number) {
  return Math.round(
    delivered * GAME_CONFIG.kopecksPerDelivery * 10,
  ) / 10;
}

/**
 * До 100 копеек отображаем копейки.
 * Начиная со 100 копеек отображаем рубли.
 */
export function formatEarnedMoney(kopecks: number) {
  if (kopecks >= 100) {
    return `${(kopecks / 100).toFixed(2).replace('.', ',')} руб.`;
  }

  return `${kopecks.toFixed(1).replace('.', ',')} коп.`;
}

export function getAddressFromRandom(
  randomValue: number,
  activeCabinets: number = GAME_CONFIG.cabinetCount,
) {
  const safeValue = Math.min(
    Math.max(randomValue, 0),
    0.999999,
  );

  const cabinetCount = Math.min(
    GAME_CONFIG.cabinetCount,
    Math.max(1, Math.floor(activeCabinets)),
  );

  const addressIndex = Math.floor(
    safeValue * cabinetCount * GAME_CONFIG.slotsPerCabinet,
  );

  return {
    cabinet: Math.floor(
      addressIndex / GAME_CONFIG.slotsPerCabinet,
    ) + 1,
    slot: (addressIndex % GAME_CONFIG.slotsPerCabinet) + 1,
    index: addressIndex,
  };
}