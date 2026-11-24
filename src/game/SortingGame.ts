
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { GameCallbacks, GameSnapshot } from './types';

import {
  GAME_CONFIG,
  getAddressFromRandom,
  getDeliveryTimeForLevel,
  getEarnedKopecks,
  getNextOrderDelay,
  formatEarnedMoney,
} from './gameConfig';

const BEST_SCORE_KEY = 'box-mayhem-best-score';

const COLORS = {
  background: 0xeaf3ff,
  ozonBlue: 0x005bff,
  ozonLight: 0x00a5ff,
  navy: 0x123b73,

  panel: 0xffffff,
  panelDark: 0xdceaff,
  outline: 0x9fc3f5,

  cell: 0xf7faff,
  cellText: 0x005bff,

  muted: 0x6684ad,
  white: 0xffffff,

  parcel: 0x0065ff,
  parcelTape: 0xc9e8ff,

  skin: 0xf1b98f,
  hair: 0x513a32,
  jacket: 0x005bff,
  jacketLight: 0x55a5ff,
  pants: 0x234775,
  shoes: 0x18345b,

  gold: 0xffb020,
  green: 0x20b879,
  red: 0xf04452,
};

type Point = {
  x: number;
  y: number;
};

type Motion = 'idle' | 'throwing' | 'falling';

export class SortingGame {
  private readonly app = new Application();

  // Игровые слои.
  private readonly root = new Container();
  private readonly boardLayer = new Container();
  private readonly cabinetLayer = new Container();
  private readonly personLayer = new Container();
  private readonly parcelLayer = new Container();
  private readonly hudLayer = new Container();
  private readonly effectLayer = new Container();

  // Коробка.
  private readonly parcel = new Container();
  private readonly parcelBody = new Graphics();

  // Адрес коробки — отдельный элемент, не часть коробки.
  private readonly parcelCode = new Text({
    text: '01 / 01',
    style: {
      fontFamily: 'Courier New, monospace',
      fontSize: 23,
      fontWeight: 'bold',
      fill: COLORS.ozonBlue,
      align: 'center',
    },
  });

  // Сообщения.
  private readonly feedbackText = new Text({
    text: 'ГОТОВ К РАБОТЕ!',
    style: {
      fontFamily: 'Courier New, monospace',
      fontSize: 14,
      fontWeight: 'bold',
      fill: COLORS.ozonBlue,
      align: 'center',
    },
  });

  // HUD.
  private readonly hudDeliveredText = new Text({
    text: 'ТОВАРЫ: 0',
    style: {
      fontFamily: 'Courier New, monospace',
      fontSize: 15,
      fontWeight: 'bold',
      fill: COLORS.navy,
    },
  });

  private readonly hudMoneyText = new Text({
    text: '0,0 коп.',
    style: {
      fontFamily: 'Courier New, monospace',
      fontSize: 12,
      fontWeight: 'bold',
      fill: COLORS.gold,
    },
  });

  private readonly hudLivesText = new Text({
    text: '♥♥♥',
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: 19,
      fontWeight: 'bold',
      fill: COLORS.red,
    },
  });

  private readonly hudMetaText = new Text({
    text: 'УРОВЕНЬ 1',
    style: {
      fontFamily: 'Courier New, monospace',
      fontSize: 10,
      fontWeight: 'bold',
      fill: COLORS.muted,
    },
  });

  private readonly hudAddressText = new Text({
    text: '01 / 01',
    style: {
      fontFamily: 'Courier New, monospace',
      fontSize: 17,
      fontWeight: 'bold',
      fill: COLORS.ozonBlue,
    },
  });

  private readonly hudTimeText = new Text({
    text: '5,0с',
    style: {
      fontFamily: 'Courier New, monospace',
      fontSize: 12,
      fontWeight: 'bold',
      fill: COLORS.navy,
    },
  });

  private readonly hudLevelTimeText = new Text({
    text: '00:45',
    style: {
      fontFamily: 'Courier New, monospace',
      fontSize: 12,
      fontWeight: 'bold',
      fill: COLORS.ozonBlue,
    },
  });

  private readonly hudTimerTrack = new Graphics();
  private readonly hudTimerFill = new Graphics();

  private hudTimerWidth = 0;

  private readonly callbacks: GameCallbacks;

  // Размеры.
  private width = 1200;
  private height = 1000;
  private isMobile = false;

  private parcelStart: Point = {
    x: 650,
    y: 666,
  };

  // Общее состояние.
  private running = false;
  private gameOver = false;
  private initialized = false;
  private destroyed = false;
  // Экономика.
  private delivered = 0;
  private best = 0;

  // Игровой процесс.
  private lives: number = GAME_CONFIG.startingLives;
  private level = 1;

  // Время уровня 1–5.
  private levelTimeRemaining: number =
    GAME_CONFIG.levelDurationSeconds;

  // Переключение уровней после завершения анимации.
  private levelTransitionPending = false;

  // Количество доставок на шестом уровне.
  private endlessDelivered = 0;

  // Время отдельной коробки.
  private timeLimit: number = GAME_CONFIG.baseDeliveryTimeSeconds;
  private timeRemaining: number = GAME_CONFIG.baseDeliveryTimeSeconds;

  // Текущий адрес.
  private targetCabinet = 1;
  private targetSlot = 1;

  // Анимация.
  private motion: Motion = 'idle';
  private motionProgress = 0;

  private motionFrom: Point = { x: 0, y: 0 };
  private motionTo: Point = { x: 0, y: 0 };

  private nextOrderDelay = 0;
  private lastTarget = -1;
  private orderResolved = false;

  private snapshotAccumulator = 0;

  constructor(
    private readonly host: HTMLDivElement,
    callbacks: GameCallbacks,
  ) {
    this.callbacks = callbacks;
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  async init() {
    const measuredWidth = Math.floor(
      this.host.getBoundingClientRect().width,
    );

    this.width = Math.max(
      320,
      Math.min(1200, measuredWidth || 1200),
    );

    this.isMobile = this.width < 760;
    this.height = this.isMobile ? 960 : 1000;

    await this.app.init({
  width: this.width,
  height: this.height,
  backgroundColor: COLORS.background,
  antialias: false,
  autoDensity: true,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  preference: 'webgl',
});

if (this.destroyed) {
  this.app.destroy();
  return;
}

    this.app.canvas.className = 'pixi-canvas';

    this.app.canvas.setAttribute(
      'aria-label',
      'Игровое поле с пронумерованными ящиками',
    );

    this.host.appendChild(this.app.canvas);

    this.root.addChild(
      this.boardLayer,
      this.cabinetLayer,
      this.personLayer,
      this.parcelLayer,
      this.hudLayer,
      this.effectLayer,
    );

    this.app.stage.addChild(this.root);

    this.best = this.readBestScore();

    this.drawBackground();
    this.drawHeader();
    this.drawCabinets();
    this.drawPerson();
    this.drawParcel();
    this.drawFeedback();
    this.drawHud();

    this.createOrder();

    this.app.ticker.add(this.update);

    this.initialized = true;

    this.emitSnapshot();
  }resize(containerWidth: number) {
  if (!this.initialized || containerWidth <= 0) return;

  const nextWidth = Math.max(
    320,
    Math.min(1200, Math.floor(containerWidth)),
  );

  if (nextWidth === this.width) return;

  this.width = nextWidth;
  this.isMobile = this.width < 760;
  this.height = this.isMobile ? 960 : 1000;

  // Изменяем размеры PixiJS Renderer.
  this.app.renderer.resize(this.width, this.height);

  // Перерисовываем фон и заголовок.
  this.boardLayer.removeChildren().forEach((child) => {
    child.destroy({ children: true });
  });

  this.drawBackground();
  this.drawHeader();

  // Перерисовываем игровые элементы.
  this.redrawCabinets();
  this.redrawPerson();
  this.redrawHud();

  // Обновляем положение и масштаб коробки.
  this.motion = 'idle';
  this.motionProgress = 0;

  this.parcel.visible = true;
  this.parcel.alpha = 1;
  this.parcel.rotation = 0;
  this.parcel.scale.set(this.isMobile ? 0.62 : 1);

  this.parcel.position.set(
    this.parcelStart.x,
    this.parcelStart.y,
  );

  this.positionParcelCode();
}

  // ==========================================
  // LEVEL SYSTEM
  // ==========================================

  private getActiveCabinetCount() {
    return Math.min(
      Math.max(1, this.level),
      GAME_CONFIG.cabinetCount,
    );
  }

  private getCabinetAreaBottom() {
    const active = this.getActiveCabinetCount();

    const columns = Math.min(
      active,
      this.isMobile ? 2 : GAME_CONFIG.cabinetColumns,
    );

    const rows = Math.ceil(active / columns);

    const cabinetHeight = this.isMobile ? 164 : 218;
    const topY = this.isMobile ? 88 : 92;
    const rowGap = this.isMobile ? 8 : 18;

    return topY + rows * cabinetHeight + (rows - 1) * rowGap;
  }

  private getHudTop() {
    return this.getCabinetAreaBottom() + (this.isMobile ? 10 : 12);
  }

  private getHudHeight() {
    return this.isMobile ? 70 : 124;
  }

  private getPersonFootY() {
    const desired =
      this.getHudTop() +
      this.getHudHeight() +
      (this.isMobile ? 205 : 225);

    return Math.min(
      this.height - (this.isMobile ? 28 : 38),
      desired,
    );
  }

  private redrawCabinets() {
    const children = this.cabinetLayer.removeChildren();

    children.forEach((child) => {
      child.destroy({ children: true });
    });

    this.drawCabinets();
  }

  private redrawHud() {
    const persistent = new Set<object>([
      this.hudDeliveredText,
      this.hudMoneyText,
      this.hudLivesText,
      this.hudMetaText,
      this.hudAddressText,
      this.hudTimeText,
      this.hudLevelTimeText,
      this.hudTimerTrack,
      this.hudTimerFill,
    ]);

    this.hudLayer.removeChildren().forEach((child) => {
      if (!persistent.has(child)) {
        child.destroy({ children: true });
      }
    });

    this.hudTimerTrack.clear();
    this.hudTimerFill.clear();

    this.drawHud();
  }

  
private redrawPerson() {
  const children = this.personLayer.removeChildren();

  children.forEach((child) => {
    // feedbackText — постоянный объект игры.
    // Его нельзя уничтожать при перерисовке персонажа.
    if (child !== this.feedbackText) {
      child.destroy({ children: true });
    }
  });

  this.drawPerson();
  this.drawFeedback();

  this.parcel.position.set(
    this.parcelStart.x,
    this.parcelStart.y,
  );

  this.positionParcelCode();
}


private advanceLevel() {
  if (
    !this.levelTransitionPending ||
    this.gameOver ||
    this.level >= 6
  ) {
    return;
  }

  // Сбрасываем флаг до обновления игрового состояния.
  this.levelTransitionPending = false;

  this.level += 1;

  // Сбрасываем состояние предыдущей коробки.
  this.motion = 'idle';
  this.motionProgress = 0;
  this.nextOrderDelay = 0;
  this.orderResolved = false;
  this.lastTarget = -1;

  this.parcel.visible = true;
  this.parcel.alpha = 1;
  this.parcel.rotation = 0;
  this.parcel.scale.set(this.isMobile ? 0.62 : 1);

  // Устанавливаем таймер нового уровня.
  if (this.level === 6) {
    this.levelTimeRemaining = Infinity;
    this.endlessDelivered = 0;
  } else {
    this.levelTimeRemaining =
      GAME_CONFIG.levelDurationSeconds;
  }

  // Перерисовываем игровое поле.
  this.redrawCabinets();
  this.redrawHud();
  this.redrawPerson();

  // Создаём новую коробку после пересчёта позиции персонажа.
  this.createOrder();

  this.feedbackText.text =
    this.level === 6
      ? 'БЕСКОНЕЧНЫЙ РЕЖИМ! НЕ СДАВАЙСЯ!'
      : `УРОВЕНЬ ${this.level}! ОТКРЫТО ШКАФОВ: ${this.level}`;

  this.refreshHud();
  this.emitSnapshot();
}

  private formatLevelTime() {
    if (this.level >= 6) {
      return '∞';
    }

    const totalSeconds = Math.ceil(
      this.levelTimeRemaining,
    );

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return (
      `${String(minutes).padStart(2, '0')}:` +
      `${String(seconds).padStart(2, '0')}`
    );
  }

  // ==========================================
  // GAME CONTROL
  // ==========================================

  setRunning(isRunning: boolean) {
    if (!this.initialized || this.gameOver) return;

    this.running = isRunning;

    if (isRunning && this.motion === 'idle') {
      this.feedbackText.text = 'ПОГНАЛИ! ИЩИ АДРЕС';
    }
  }

  reset() {
    this.delivered = 0;
    this.lives = GAME_CONFIG.startingLives;
    this.level = 1;

    this.levelTimeRemaining =
      GAME_CONFIG.levelDurationSeconds;

    this.levelTransitionPending = false;
    this.endlessDelivered = 0;

    this.gameOver = false;
    this.running = false;

    this.motion = 'idle';
    this.motionProgress = 0;

    this.nextOrderDelay = 0;
    this.orderResolved = false;
    this.lastTarget = -1;
    this.snapshotAccumulator = 0;

    this.parcel.visible = true;
    this.parcel.alpha = 1;
    this.parcel.rotation = 0;
    this.parcel.scale.set(this.isMobile ? 0.62 : 1);

    this.best = this.readBestScore();

    this.redrawCabinets();
    this.redrawHud();
    this.redrawPerson();

    this.feedbackText.text = 'ГОТОВ К НОВОЙ СМЕНЕ!';

    this.createOrder();
    this.emitSnapshot();
  }

 destroy() {
  if (this.destroyed) return;

  this.destroyed = true;

  if (!this.initialized) return;

  this.app.ticker.remove(this.update);

  this.app.destroy(
    { removeView: true },
    { children: true },
  );

  this.initialized = false;
}

  // ==========================================
  // GAME LOOP
  // ==========================================

private readonly update = (ticker: { deltaMS: number }) => {
  if (!this.running || this.gameOver) return;

  const delta = Math.min(ticker.deltaMS / 1000, 0.05);

  // Общий таймер уровней 1–5.
  if (this.level < 6 && !this.levelTransitionPending) {
    this.levelTimeRemaining = Math.max(
      0,
      this.levelTimeRemaining - delta,
    );

    if (this.levelTimeRemaining <= 0) {
      this.levelTimeRemaining = 0;
      this.levelTransitionPending = true;
      this.feedbackText.text = 'ВРЕМЯ! ПЕРЕХОД НА СЛЕДУЮЩИЙ УРОВЕНЬ...';
    }
  }

  // Пока коробка летит или падает, завершаем анимацию.
  if (this.motion !== 'idle') {
    const motionFinished = this.updateMotion(delta);

    if (
      this.levelTransitionPending &&
      motionFinished &&
      !this.gameOver
    ) {
      this.advanceLevel();
    }

    return;
  }

  // Если анимации нет — переключаем уровень сразу.
  if (this.levelTransitionPending) {
    this.advanceLevel();
    return;
  }

  // Задержка перед следующей коробкой.
  if (this.nextOrderDelay > 0) {
    this.nextOrderDelay = Math.max(
      0,
      this.nextOrderDelay - delta,
    );

    if (this.nextOrderDelay <= 0) {
      this.createOrder();
    }

    return;
  }

  // Таймер текущей коробки.
  this.timeRemaining = Math.max(
    0,
    this.timeRemaining - delta,
  );

  this.updateHudTimer();

  this.snapshotAccumulator += delta;

  if (this.snapshotAccumulator >= 0.1) {
    this.snapshotAccumulator = 0;
    this.emitSnapshot();
  }

  if (
    this.timeRemaining <= 0 &&
    !this.orderResolved
  ) {
    this.resolveMiss('ВРЕМЯ ВЫШЛО!');
  }
};

  // ==========================================
  // BACKGROUND
  // ==========================================

  private drawBackground() {
    const bg = new Graphics();

    bg.rect(0, 0, this.width, this.height)
      .fill(COLORS.background);

    for (let y = 0; y < this.height; y += 32) {
      bg.rect(0, y, this.width, 1)
        .fill({
          color: COLORS.ozonBlue,
          alpha: 0.035,
        });
    }

    for (let x = 0; x < this.width; x += 32) {
      bg.rect(x, 0, 1, this.height)
        .fill({
          color: COLORS.ozonBlue,
          alpha: 0.025,
        });
    }

    bg.roundRect(
      10,
      10,
      this.width - 20,
      this.height - 20,
      13,
    ).stroke({
      color: COLORS.outline,
      width: 3,
    });

    this.boardLayer.addChild(bg);
  }

  // ==========================================
  // HEADER
  // ==========================================

  private drawHeader() {
    const title = this.makeText(
      'КОРОБОЧНЫЙ ПЕРЕПОЛОХ',
      this.isMobile ? 16 : 27,
      COLORS.navy,
      true,
    );

    title.position.set(
      this.isMobile ? 15 : 38,
      33,
    );

    title.anchor.set(0, 0.5);

    this.boardLayer.addChild(title);

    if (!this.isMobile) {
      const subtitle = this.makeText(
        'PIXEL SORTING ARCADE',
        12,
        COLORS.muted,
        true,
      );

      subtitle.position.set(
        this.width - 38,
        35,
      );

      subtitle.anchor.set(1, 0.5);

      this.boardLayer.addChild(subtitle);
    }

    const line = new Graphics();

    line.roundRect(
      20,
      64,
      this.width - 40,
      3,
      2,
    ).fill(COLORS.outline);

    this.boardLayer.addChild(line);
  }

  // ==========================================
  // CABINETS
  // ==========================================

  private drawCabinets() {
    const activeCabinets = this.getActiveCabinetCount();

    const columns = Math.min(
      activeCabinets,
      this.isMobile ? 2 : GAME_CONFIG.cabinetColumns,
    );

    const marginX = this.isMobile ? 10 : 36;
    const gapX = this.isMobile ? 8 : 18;

    const cabinetHeight = this.isMobile ? 164 : 218;
    const topY = this.isMobile ? 88 : 92;
    const rowGap = this.isMobile ? 8 : 18;

    const cabinetWidth =
      (this.width - marginX * 2 - gapX * (columns - 1)) /
      columns;

    for (
      let cabinetIndex = 0;
      cabinetIndex < activeCabinets;
      cabinetIndex += 1
    ) {
      const column = cabinetIndex % columns;
      const row = Math.floor(cabinetIndex / columns);

      const x = marginX + column * (cabinetWidth + gapX);
      const y = topY + row * (cabinetHeight + rowGap);

      const cabinet = new Graphics();

      cabinet.roundRect(
        x,
        y,
        cabinetWidth,
        cabinetHeight,
        9,
      )
        .fill(COLORS.panel)
        .stroke({
          color: COLORS.outline,
          width: 2,
        });

      cabinet.roundRect(
        x + 5,
        y + 5,
        cabinetWidth - 10,
        30,
        5,
      ).fill(COLORS.ozonBlue);

      this.cabinetLayer.addChild(cabinet);

      const label = this.makeText(
        `ЯЩИК №${String(cabinetIndex + 1).padStart(2, '0')}`,
        this.isMobile ? 11 : 16,
        COLORS.white,
        true,
      );

      label.position.set(x + 13, y + 20);
      label.anchor.set(0, 0.5);

      this.cabinetLayer.addChild(label);

      const gridX = x + (this.isMobile ? 8 : 15);
      const gridY = y + 42;

      const gridWidth =
        cabinetWidth - (this.isMobile ? 16 : 30);

      const gridHeight =
        cabinetHeight - (this.isMobile ? 54 : 62);

      const cellGapX = this.isMobile ? 3 : 5;
      const cellGapY = this.isMobile ? 4 : 5;

      const cellWidth =
        (gridWidth - cellGapX * 3) /
        GAME_CONFIG.gridColumns;

      const cellHeight =
        (gridHeight - cellGapY * 2) /
        GAME_CONFIG.gridRows;

      for (
        let slotIndex = 0;
        slotIndex < GAME_CONFIG.slotsPerCabinet;
        slotIndex += 1
      ) {
        const cellColumn =
          slotIndex % GAME_CONFIG.gridColumns;

        const cellRow = Math.floor(
          slotIndex / GAME_CONFIG.gridColumns,
        );

        const cellX =
          gridX + cellColumn * (cellWidth + cellGapX);

        const cellY =
          gridY + cellRow * (cellHeight + cellGapY);

        const cell = new Graphics();

        cell.roundRect(
          0,
          0,
          cellWidth,
          cellHeight,
          4,
        )
          .fill(COLORS.cell)
          .stroke({
            color: COLORS.outline,
            width: 1.5,
          });

        cell.position.set(cellX, cellY);

        cell.eventMode = 'static';
        cell.cursor = 'pointer';

        cell.on('pointerover', () => {
          if (this.running && this.motion === 'idle') {
            cell.alpha = 0.72;
          }
        });

        cell.on('pointerout', () => {
          cell.alpha = 1;
        });

        cell.on('pointertap', () => {
          this.handleCellTap(
            cabinetIndex + 1,
            slotIndex + 1,
            {
              x: cellX + cellWidth / 2,
              y: cellY + cellHeight / 2,
            },
          );
        });

        this.cabinetLayer.addChild(cell);

        const number = this.makeText(
          String(slotIndex + 1).padStart(2, '0'),
          this.isMobile ? 12 : 18,
          COLORS.cellText,
          true,
        );

        number.position.set(
          cellX + cellWidth / 2,
          cellY + cellHeight / 2,
        );

        number.anchor.set(0.5);

        this.cabinetLayer.addChild(number);
      }
    }
  }

  // ==========================================
  // CHARACTER
  // ==========================================

  private drawPerson() {
    const personScale = this.isMobile ? 0.62 : 1;

    const personX = this.width / 2;
    const footY = this.getPersonFootY();

    const shadow = new Graphics();

    shadow.ellipse(
      personX,
      footY - 2,
      49 * personScale,
      9 * personScale,
    ).fill({
      color: COLORS.navy,
      alpha: 0.14,
    });

    const person = new Container();

    person.position.set(personX, footY);
    person.scale.set(personScale);

    const character = new Graphics();

    // Ноги.
    character.rect(-27, -43, 20, 36).fill(COLORS.pants);
    character.rect(7, -43, 20, 36).fill(COLORS.pants);

    // Обувь.
    character.rect(-32, -9, 27, 10).fill(COLORS.shoes);
    character.rect(5, -9, 29, 10).fill(COLORS.shoes);

    // Куртка.
    character.rect(-36, -116, 72, 74).fill(COLORS.jacket);
    character.rect(-30, -116, 60, 10).fill(COLORS.jacketLight);

    // Руки.
    character.rect(-51, -108, 17, 49).fill(COLORS.jacket);
    character.rect(34, -108, 17, 44).fill(COLORS.jacket);

    character.rect(-51, -62, 17, 14).fill(COLORS.skin);
    character.rect(34, -65, 17, 14).fill(COLORS.skin);

    // Голова.
    character.rect(-12, -137, 24, 25).fill(COLORS.skin);
    character.rect(-28, -181, 56, 46).fill(COLORS.skin);

    // Волосы.
    character.rect(-31, -185, 62, 13).fill(COLORS.hair);
    character.rect(-31, -174, 9, 20).fill(COLORS.hair);
    character.rect(22, -174, 9, 19).fill(COLORS.hair);

    // Кепка.
    character.rect(-33, -195, 65, 12).fill(COLORS.ozonBlue);
    character.rect(13, -187, 29, 6).fill(COLORS.ozonLight);

    // Лицо.
    character.rect(-16, -163, 5, 5).fill(COLORS.navy);
    character.rect(10, -163, 5, 5).fill(COLORS.navy);
    character.rect(-5, -144, 10, 3).fill(0xc77b63);

    person.addChild(character);

    this.personLayer.addChild(shadow, person);

    const hand = new Graphics();

    hand.circle(
      personX + 42 * personScale,
      footY - 66 * personScale,
      8 * personScale,
    ).fill(COLORS.skin);

    this.personLayer.addChild(hand);

    this.parcelStart = {
      x: personX + 68 * personScale,
      y: footY - 102 * personScale,
    };

    const caption = this.makeText(
      'СОРТИРОВЩИК',
      this.isMobile ? 9 : 12,
      COLORS.muted,
      true,
    );

    caption.position.set(
      personX,
      footY + (this.isMobile ? 9 : 17),
    );

    caption.anchor.set(0.5, 0);

    this.personLayer.addChild(caption);
  }

  // ==========================================
  // PARCEL
  // ==========================================

  private drawParcel() {
    const parcelScale = this.isMobile ? 0.62 : 1;

    this.parcelBody.roundRect(
      0,
      0,
      74,
      55,
      5,
    )
      .fill(COLORS.parcel)
      .stroke({
        color: COLORS.navy,
        width: 2,
      });

    this.parcelBody.rect(
      32,
      0,
      10,
      55,
    ).fill(COLORS.parcelTape);

    this.parcelBody.rect(
      0,
      22,
      74,
      9,
    ).fill(COLORS.parcelTape);

    this.parcelBody.roundRect(
      10,
      7,
      54,
      14,
      2,
    ).fill(COLORS.white);

    // Внутри коробки остаётся только графика.
    // Адрес вынесен в отдельный текстовый элемент.
    this.parcel.addChild(this.parcelBody);

    this.parcel.position.set(
      this.parcelStart.x,
      this.parcelStart.y,
    );

    this.parcel.pivot.set(37, 27);
    this.parcel.scale.set(parcelScale);

    this.parcelLayer.addChild(this.parcel);

    // Адрес располагается над персонажем.
    this.parcelCode.anchor.set(0.5);
    this.parcelCode.style = {
      fontFamily: 'Courier New, monospace',
      fontSize: this.isMobile ? 15 : 23,
      fontWeight: 'bold',
      fill: COLORS.ozonBlue,
      align: 'center',
    };

    this.parcelLayer.addChild(this.parcelCode);

    this.positionParcelCode();
  }

  // ==========================================
  // PARCEL CODE POSITION
  // ==========================================

  private positionParcelCode() {
    const footY = this.getPersonFootY();

    this.parcelCode.position.set(
      this.width / 2,
      footY - (this.isMobile ? 160 : 255),
    );
  }

  // ==========================================
  // FEEDBACK
  // ==========================================

  private drawFeedback() {
    this.feedbackText.anchor.set(0.5);

    const personScale = this.isMobile ? 0.62 : 1;

    this.feedbackText.style = {
      fontFamily: 'Courier New, monospace',
      fontSize: this.isMobile ? 14 : 20,
      fontWeight: 'bold',
      fill: COLORS.ozonBlue,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: this.width - 40,
    };

    this.feedbackText.position.set(
      this.width / 2,
      this.getPersonFootY() - 220 * personScale,
    );

    this.personLayer.addChild(this.feedbackText);
  }

  // ==========================================
  // HUD
  // ==========================================

  private drawHud() {
    const background = new Graphics();

    let addressLabel: Text | null = null;

    const y = this.getHudTop();

    if (this.isMobile) {
      const x = 10;
      const width = this.width - 20;
      const height = 70;

      background.roundRect(
        x, y + 3, width, height, 9,
      ).fill({
        color: COLORS.navy,
        alpha: 0.10,
      });

      background.roundRect(
        x, y, width, height, 9,
      ).fill(COLORS.white).stroke({
        color: COLORS.outline,
        width: 2,
      });

      this.hudDeliveredText.style = {
        fontFamily: 'Courier New, monospace',
        fontSize: 10,
        fontWeight: 'bold',
        fill: COLORS.navy,
      };

      this.hudMoneyText.style = {
        fontFamily: 'Courier New, monospace',
        fontSize: 10,
        fontWeight: 'bold',
        fill: COLORS.gold,
      };

      this.hudLivesText.style = {
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        fontWeight: 'bold',
        fill: COLORS.red,
      };

      this.hudMetaText.style = {
        fontFamily: 'Courier New, monospace',
        fontSize: 9,
        fontWeight: 'bold',
        fill: COLORS.muted,
      };

      this.hudAddressText.style = {
        fontFamily: 'Courier New, monospace',
        fontSize: 10,
        fontWeight: 'bold',
        fill: COLORS.ozonBlue,
      };

      this.hudLevelTimeText.style = {
        fontFamily: 'Courier New, monospace',
        fontSize: 10,
        fontWeight: 'bold',
        fill: COLORS.ozonBlue,
      };

      this.hudTimeText.style = {
        fontFamily: 'Courier New, monospace',
        fontSize: 10,
        fontWeight: 'bold',
        fill: COLORS.navy,
      };

      const centerY = y + 15;

      this.hudDeliveredText.position.set(x + 8, centerY);
      this.hudMoneyText.position.set(x + 48, centerY);
      this.hudLivesText.position.set(x + 105, centerY);
      this.hudMetaText.position.set(x + 151, centerY);

      this.hudLevelTimeText.anchor.set(1, 0.5);
      this.hudLevelTimeText.position.set(
        x + width - 8,
        centerY,
      );

      this.hudAddressText.position.set(x + 8, y + 40);

      this.hudTimeText.anchor.set(1, 0.5);
      this.hudTimeText.position.set(
        x + width - 8,
        y + 40,
      );

      this.hudTimerWidth = width - 16;

      this.hudTimerTrack.roundRect(
        0, 0, this.hudTimerWidth, 5, 3,
      ).fill(COLORS.panelDark);

      this.hudTimerTrack.position.set(x + 8, y + 57);
      this.hudTimerFill.position.set(x + 8, y + 57);
    } else {
      const panelWidth = 220;
      const panelHeight = 124;

      const leftX = 24;
      const rightX = this.width - panelWidth - 24;

      background.roundRect(
        leftX, y + 4, panelWidth, panelHeight, 10,
      ).fill({
        color: COLORS.navy,
        alpha: 0.10,
      });

      background.roundRect(
        rightX, y + 4, panelWidth, panelHeight, 10,
      ).fill({
        color: COLORS.navy,
        alpha: 0.10,
      });

      background.roundRect(
        leftX, y, panelWidth, panelHeight, 10,
      ).fill(COLORS.white).stroke({
        color: COLORS.outline,
        width: 2,
      });

      background.roundRect(
        rightX, y, panelWidth, panelHeight, 10,
      ).fill(COLORS.white).stroke({
        color: COLORS.outline,
        width: 2,
      });

      this.hudDeliveredText.position.set(leftX + 14, y + 21);
      this.hudMoneyText.position.set(leftX + 14, y + 46);
      this.hudLivesText.position.set(leftX + 14, y + 72);
      this.hudMetaText.position.set(leftX + 105, y + 75);
      this.hudLevelTimeText.position.set(leftX + 14, y + 101);

      this.hudLivesText.style = {
        fontFamily: 'Arial, sans-serif',
        fontSize: 19,
        fontWeight: 'bold',
        fill: COLORS.red,
      };

      this.hudLevelTimeText.style = {
        fontFamily: 'Courier New, monospace',
        fontSize: 10,
        fontWeight: 'bold',
        fill: COLORS.ozonBlue,
      };

      addressLabel = this.makeText(
        'АДРЕС КОРОБКИ',
        10,
        COLORS.muted,
        true,
      );

      addressLabel.position.set(rightX + 14, y + 16);

      this.hudAddressText.style = {
        fontFamily: 'Courier New, monospace',
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLORS.ozonBlue,
      };

      this.hudAddressText.position.set(rightX + 14, y + 43);

      this.hudTimeText.anchor.set(1, 0.5);
      this.hudTimeText.position.set(
        rightX + panelWidth - 14,
        y + 50,
      );

      this.hudTimerWidth = panelWidth - 28;

      this.hudTimerTrack.roundRect(
        0, 0, this.hudTimerWidth, 8, 4,
      ).fill(COLORS.panelDark);

      this.hudTimerTrack.position.set(rightX + 14, y + 82);
      this.hudTimerFill.position.set(rightX + 14, y + 82);

      this.hudLevelTimeText.anchor.set(0, 0);
    }

    this.hudLayer.addChild(
      background,
      this.hudTimerTrack,
      this.hudTimerFill,
    );

    if (addressLabel) {
      this.hudLayer.addChild(addressLabel);
    }

    this.hudLayer.addChild(
      this.hudDeliveredText,
      this.hudMoneyText,
      this.hudLivesText,
      this.hudMetaText,
      this.hudAddressText,
      this.hudTimeText,
      this.hudLevelTimeText,
    );

    this.refreshHud();
  }

  private refreshHud() {
    this.hudDeliveredText.text = this.isMobile
      ? `Т:${this.delivered}`
      : `ТОВАРЫ: ${this.delivered}`;

    this.hudMoneyText.text = formatEarnedMoney(
      getEarnedKopecks(this.delivered),
    );

    this.hudLivesText.text =
      '♥'.repeat(this.lives) +
      '♡'.repeat(GAME_CONFIG.startingLives - this.lives);

    this.hudMetaText.text = this.isMobile
      ? `УР.${this.level}`
      : `УРОВЕНЬ ${this.level}`;

    this.hudAddressText.text = this.isMobile
      ? `ЯЩИК ${this.targetCabinet} · ЯЧ. ${this.targetSlot}`
      : `ЯЩИК ${String(this.targetCabinet).padStart(2, '0')} / ЯЧЕЙКА ${String(this.targetSlot).padStart(2, '0')}`;

    this.hudTimeText.text =
      `${this.timeRemaining.toFixed(1).replace('.', ',')}с`;

    this.hudLevelTimeText.text = this.isMobile
      ? this.formatLevelTime()
      : this.level === 6
        ? 'БЕСКОНЕЧНЫЙ РЕЖИМ'
        : `ОСТАЛОСЬ: ${this.formatLevelTime()}`;

    this.updateHudTimer();
  }

  private updateHudTimer() {
    const ratio = this.timeLimit > 0
      ? Math.max(
          0,
          Math.min(1, this.timeRemaining / this.timeLimit),
        )
      : 0;

    const color =
      ratio > 0.5
        ? COLORS.green
        : ratio > 0.22
          ? COLORS.gold
          : COLORS.red;

    this.hudTimerFill.clear();

    const width = this.hudTimerWidth * ratio;

    if (width > 0) {
      this.hudTimerFill.roundRect(
        0,
        0,
        width,
        this.isMobile ? 5 : 8,
        4,
      ).fill(color);
    }
  }

  // ==========================================
  // INPUT
  // ==========================================

  private handleCellTap(
    cabinet: number,
    slot: number,
    destination: Point,
  ) {
    if (
      !this.running ||
      this.gameOver ||
      this.levelTransitionPending ||
      this.motion !== 'idle' ||
      this.nextOrderDelay > 0 ||
      this.orderResolved
    ) {
      return;
    }

    if (
      cabinet === this.targetCabinet &&
      slot === this.targetSlot
    ) {
      this.orderResolved = true;

      this.motion = 'throwing';
      this.motionProgress = 0;

      this.motionFrom = { ...this.parcelStart };
      this.motionTo = destination;

      this.feedbackText.text = 'ОТЛИЧНО! ТОЧНО В ЦЕЛЬ!';
    } else {
      this.resolveMiss('НЕ ТОТ АДРЕС!');
    }
  }

  private resolveMiss(message: string) {
    if (this.orderResolved || this.gameOver) return;

    this.orderResolved = true;

    this.lives = Math.max(
      0,
      this.lives - 1,
    );

    this.refreshHud();

    this.motion = 'falling';
    this.motionProgress = 0;

    this.motionFrom = { ...this.parcelStart };

    this.motionTo = {
      x: this.parcelStart.x + 12,
      y: this.parcelStart.y + 115,
    };

    this.feedbackText.text = message;

    this.emitSnapshot();
  }

  // ==========================================
  // PARCEL ANIMATION
  // ==========================================

  private updateMotion(delta: number): boolean {
    const duration =
      this.motion === 'throwing'
        ? GAME_CONFIG.throwDurationSeconds
        : GAME_CONFIG.dropDurationSeconds;

    this.motionProgress = Math.min(
      1,
      this.motionProgress + delta / duration,
    );

    const progress = this.motionProgress;
    const eased = 1 - Math.pow(1 - progress, 2);

    const x = this.lerp(
      this.motionFrom.x,
      this.motionTo.x,
      eased,
    );

    const y = this.lerp(
      this.motionFrom.y,
      this.motionTo.y,
      eased,
    );

    const arc =
      this.motion === 'throwing'
        ? Math.sin(progress * Math.PI) * 88
        : 0;

    this.parcel.position.set(
      x,
      y - arc,
    );

    this.parcel.rotation =
      this.motion === 'throwing'
        ? progress * 0.35
        : progress * 0.8;

    const initialScale = this.isMobile ? 0.62 : 1;

    const scaleFactor =
      this.motion === 'throwing'
        ? 1 - progress * 0.32
        : 1 - progress * 0.18;

    this.parcel.scale.set(
      initialScale * scaleFactor,
    );

    if (this.motion === 'falling') {
      this.parcel.alpha = 1 - progress * 0.15;
    }

    if (progress < 1) {
      return false;
    }

    if (this.motion === 'throwing') {
      this.delivered += 1;

      if (this.level === 6) {
        this.endlessDelivered += 1;
      }

      this.best = Math.max(
        this.best,
        this.delivered,
      );

      this.writeBestScore(this.best);

      this.showCoinBurst(
        this.motionTo.x,
        this.motionTo.y,
      );

      this.feedbackText.text =
        this.level === 6 &&
        this.endlessDelivered %
          GAME_CONFIG.level6SpeedUpEveryDeliveries === 0
          ? 'БЫСТРЕЕ! НЕ ОСТАНАВЛИВАЙСЯ!'
          : 'ЕСТЬ ДОСТАВКА! +0,7 КОП.';
    }

    this.parcel.visible = false;

    this.motion = 'idle';
    this.parcel.rotation = 0;
    this.parcel.alpha = 1;

    this.parcel.scale.set(
      this.isMobile ? 0.62 : 1,
    );

    this.nextOrderDelay =
      this.lives > 0
        ? getNextOrderDelay(this.level, this.endlessDelivered)
        : 0;

    this.refreshHud();

    if (this.lives <= 0) {
      this.finishGame();
    } else {
      this.emitSnapshot();
    }

    return true;
  }

  // ==========================================
  // NEW ORDER
  // ==========================================

  private createOrder() {
    if (this.gameOver) return;

    const activeCabinets = this.getActiveCabinetCount();

    const totalAddresses =
      activeCabinets * GAME_CONFIG.slotsPerCabinet;

    let address = getAddressFromRandom(
      Math.random(),
      activeCabinets,
    );

    // Не повторяем один адрес подряд.
    if (address.index === this.lastTarget) {
      const nextIndex =
        (address.index + 1) % totalAddresses;

      address = getAddressFromRandom(
        nextIndex / totalAddresses,
        activeCabinets,
      );
    }

    this.lastTarget = address.index;

    this.targetCabinet = address.cabinet;
    this.targetSlot = address.slot;

    this.timeLimit = getDeliveryTimeForLevel(
      this.level,
      this.endlessDelivered,
    );

    this.timeRemaining = this.timeLimit;

    this.orderResolved = false;

    this.parcel.visible = true;

    this.parcel.position.set(
      this.parcelStart.x,
      this.parcelStart.y,
    );

    this.parcel.alpha = 1;
    this.parcel.rotation = 0;

    this.parcel.scale.set(
      this.isMobile ? 0.62 : 1,
    );

    this.parcelCode.text =
      `${String(this.targetCabinet).padStart(2, '0')} / ` +
      `${String(this.targetSlot).padStart(2, '0')}`;

    this.positionParcelCode();

    this.feedbackText.text = 'НОВАЯ КОРОБКА! ИЩИ АДРЕС';

    this.emitSnapshot();
  }

  // ==========================================
  // SUCCESS EFFECT
  // ==========================================

  private showCoinBurst(x: number, y: number) {
    const burst = new Text({
      text: '+0,7 КОП.',
      style: {
        fontFamily: 'Courier New, monospace',
        fontSize: 19,
        fontWeight: 'bold',
        fill: COLORS.gold,
        stroke: {
          color: 0xffffff,
          width: 4,
        },
      },
    });

    burst.anchor.set(0.5);
    burst.position.set(x, y - 8);

    this.effectLayer.addChild(burst);

    let elapsed = 0;

    const animate = (ticker: { deltaMS: number }) => {
      const delta = ticker.deltaMS / 1000;

      elapsed += delta;

      burst.y -= delta * 34;
      burst.alpha = Math.max(
        0,
        1 - elapsed / 0.7,
      );

      if (elapsed >= 0.7) {
        this.app.ticker.remove(animate);
        this.effectLayer.removeChild(burst);
        burst.destroy();
      }
    };

    this.app.ticker.add(animate);
  }

  // ==========================================
  // GAME OVER
  // ==========================================

  private finishGame() {
    this.gameOver = true;
    this.running = false;

    this.parcel.visible = false;
    this.feedbackText.text = 'СМЕНА ЗАВЕРШЕНА';

    this.emitSnapshot();

    this.callbacks.onGameOver();
  }

  // ==========================================
  // SNAPSHOT
  // ==========================================

  private emitSnapshot() {
    const snapshot: GameSnapshot = {
      delivered: this.delivered,
      earnedKopecks: getEarnedKopecks(this.delivered),
      lives: this.lives,
      level: this.level,
      best: this.best,

      targetCabinet: this.targetCabinet,
      targetSlot: this.targetSlot,

      timeLeft: this.timeRemaining,
      timeLimit: this.timeLimit,
    };

    this.refreshHud();

    this.callbacks.onSnapshot(snapshot);
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private makeText(
    text: string,
    fontSize: number,
    fill: number,
    bold = false,
  ) {
    return new Text({
      text,
      style: {
        fontFamily: 'Courier New, monospace',
        fontSize,
        fontWeight: bold ? 'bold' : 'normal',
        fill,
      },
    });
  }

  private readBestScore() {
    try {
      return (
        Number(
          window.localStorage.getItem(BEST_SCORE_KEY) ?? 0,
        ) || 0
      );
    } catch {
      return 0;
    }
  }

  private writeBestScore(value: number) {
    try {
      window.localStorage.setItem(
        BEST_SCORE_KEY,
        String(value),
      );
    } catch {
      // Игра работает и без LocalStorage.
    }
  }

  private lerp(
    from: number,
    to: number,
    progress: number,
  ) {
    return from + (to - from) * progress;
  }
}
