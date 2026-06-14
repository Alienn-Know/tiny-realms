import {
  Container,
  FederatedWheelEvent,
  Graphics,
  Rectangle,
  Sprite,
  Texture,
  TilingSprite,
  type FederatedPointerEvent,
} from 'pixi.js';
import { getIcons16Texture, type Icons16Name } from '../assets/icons16Atlas';
import { getUiMiniTexture, UI_MINI_CELL } from '../assets/uiMiniAtlas';
import {
  createGameBitmapText,
  GAME_TEXT_SIZES,
  type GameTextSize,
} from '../features/fonts/gameBitmapText';
import { createUiButton } from './uiButton';

type UiWindowButtonHandlers = {
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm?: () => void;
};

// список всех параметров окна
export type CreateUiWindowOptions = UiWindowButtonHandlers & {
  title: string;
  message: string;
  iconName: Icons16Name;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** Ширина области сообщения (перенос по пикселям). По умолчанию до колонки скролла. */
  messageMaxWidth?: number;
  /** Высота видимой области; низ скроллится кнопками по одной строке. */
  messageMaxHeight?: number;
};

// список всех параметров уведомлений
export type CreateUiAlertOptions = {
  title: string;
  message: string;
  iconName: Icons16Name;
  onClose?: () => void;
  width?: number;
  /** Высота панели (кратно сетке рамки). По умолчанию {@link DEFAULT_ALERT_HEIGHT}. */
  height?: number;
  messageMaxWidth?: number;
  messageMaxHeight?: number;
  /** Размер текста сообщения; по умолчанию 9 (caption). */
  messageFontSize?: GameTextSize;
};

export type UiWindow = Container & {
  setMessage: (message: string) => void;
  scrollBy: (delta: number) => void;
};

export type UiAlert = Container & {
  setMessage: (message: string) => void;
  scrollBy: (delta: number) => void;
};

/** Лёгкий оттенок поверх запечённого цвета атласа (вторичный текст). */
const WINDOW_MESSAGE_TINT = 0xc8b8a8;
const PANEL_TILE_SCALE = 4;
const PANEL_TILE_SIZE = UI_MINI_CELL * PANEL_TILE_SCALE;
const DEFAULT_WINDOW_WIDTH = 384;
const DEFAULT_WINDOW_HEIGHT = 256;
const DEFAULT_ALERT_WIDTH = 384;
const DEFAULT_ALERT_HEIGHT = 192;

const WINDOW_MESSAGE_INSET_X = 18;
const WINDOW_MESSAGE_INSET_Y = 58;
/** Ширина правой колонки под кнопки вверх/вниз. */
const WINDOW_SCROLL_COLUMN_W = 64;
/** Зарезервировать снизу под полосу с отмена/ОК (и зазор). */
const WINDOW_MESSAGE_BOTTOM_RESERVE = 72;
const WINDOW_MESSAGE_FONT_SIZE = 18;
/** Шаг скролла «на одну строку» для body 18px. */
const WINDOW_MESSAGE_LINE_STEP = Math.round(WINDOW_MESSAGE_FONT_SIZE * 1.125);

/** Нижний отступ области текста в алерте (нет полосы отмена/ОК). */
const ALERT_MESSAGE_BOTTOM_PAD = 24;

// определить размер px по идентификатору
function resolveGameTextPx(size: GameTextSize | undefined, fallback: number): number {
  if (size === undefined) {
    return fallback;
  }
  if (typeof size === 'string') {
    return GAME_TEXT_SIZES[size];
  }
  return size;
}

function snapPanelSizeToTileGrid(size: number): number {
  return Math.ceil(size / PANEL_TILE_SIZE) * PANEL_TILE_SIZE;
}

function createPanelPart(
  texture: Texture,
  x: number,
  y: number,
  scale: number,
): Sprite {
  const sprite = new Sprite(texture);

  sprite.position.set(x, y);
  sprite.scale.set(scale);
  return sprite;
}

// Тайлит текстуру в прямоугольник (width x height) одним draw call.
function createTiledPanelStrip(
  texture: Texture,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
): TilingSprite {
  const strip = new TilingSprite({
    texture,
    width: width / scale,
    height: height / scale,
  });
  strip.position.set(x, y);
  strip.scale.set(scale);
  return strip;
}

// 9-patch рамка: 4 угла (Sprite) + 4 ребра + центр (TilingSprite).
async function createPanelBackground(
  width: number,
  height: number,
): Promise<Container> {
  const root = new Container();
  const tileSize = PANEL_TILE_SIZE;
  const innerWidth = Math.max(tileSize, width - tileSize * 2);
  const innerHeight = Math.max(tileSize, height - tileSize * 2);
  const [
    topLeft,
    top,
    topRight,
    left,
    center,
    right,
    bottomLeft,
    bottom,
    bottomRight,
  ] = await Promise.all([
    getUiMiniTexture('panelTopLeft'),
    getUiMiniTexture('panelTop'),
    getUiMiniTexture('panelTopRight'),
    getUiMiniTexture('panelLeft'),
    getUiMiniTexture('panelCenter'),
    getUiMiniTexture('panelRight'),
    getUiMiniTexture('panelBottomLeft'),
    getUiMiniTexture('panelBottom'),
    getUiMiniTexture('panelBottomRight'),
  ]);

  root.addChild(createPanelPart(topLeft, 0, 0, PANEL_TILE_SCALE));
  root.addChild(createTiledPanelStrip(top, tileSize, 0, innerWidth, tileSize, PANEL_TILE_SCALE));
  root.addChild(createPanelPart(topRight, width - tileSize, 0, PANEL_TILE_SCALE));
  root.addChild(createTiledPanelStrip(left, 0, tileSize, tileSize, innerHeight, PANEL_TILE_SCALE));
  root.addChild(createTiledPanelStrip(center, tileSize, tileSize, innerWidth, innerHeight, PANEL_TILE_SCALE));
  root.addChild(createTiledPanelStrip(right, width - tileSize, tileSize, tileSize, innerHeight, PANEL_TILE_SCALE));
  root.addChild(createPanelPart(bottomLeft, 0, height - tileSize, PANEL_TILE_SCALE));
  root.addChild(createTiledPanelStrip(bottom, tileSize, height - tileSize, innerWidth, tileSize, PANEL_TILE_SCALE));
  root.addChild(createPanelPart(bottomRight, width - tileSize, height - tileSize, PANEL_TILE_SCALE));

  return root;
}

// Создаёт viewport с маской, текстом, drag/wheel-скроллом и кнопками up/down.
// Возвращает контролы: setMessage/scrollBy для прокидывания в UI root.
type MessageViewport = {
  viewport: Container;
  upButton: Awaited<ReturnType<typeof createUiButton>>;
  downButton: Awaited<ReturnType<typeof createUiButton>>;
  setMessage: (message: string) => void;
  scrollBy: (delta: number) => void;
};

async function setupMessageViewport(
  panelWidth: number,
  message: string,
  boxWidth: number,
  boxHeight: number,
  fontSize: GameTextSize,
  lineStep: number,
): Promise<MessageViewport> {
  // Контейнер с маской: обрезает текст по границам области.
  const viewport = new Container();
  viewport.position.set(WINDOW_MESSAGE_INSET_X, WINDOW_MESSAGE_INSET_Y);
  const mask = new Graphics().rect(0, 0, boxWidth, boxHeight).fill(0xffffff);
  viewport.mask = mask;
  viewport.addChild(mask);

  const text = createGameBitmapText({
    text: message,
    face: 'sans',
    size: fontSize,
    align: 'left',
    maxWidth: boxWidth,
    tint: WINDOW_MESSAGE_TINT,
  });
  viewport.addChild(text);

  viewport.eventMode = 'static';
  viewport.hitArea = new Rectangle(0, 0, boxWidth, boxHeight);
  viewport.cursor = 'grab';

  let scrollPx = 0;
  let dragPointerId: number | null = null;
  let lastDragClientY = 0;

  // Drag-to-scroll: подписки на window, чтобы не терять палец за краем viewport.
  function onPointerMove(ev: PointerEvent): void {
    if (dragPointerId === null || ev.pointerId !== dragPointerId) {
      return;
    }
    scrollPx -= ev.clientY - lastDragClientY;
    lastDragClientY = ev.clientY;
    applyScroll();
  }
  function endPointerDrag(ev: PointerEvent): void {
    if (dragPointerId === null || ev.pointerId !== dragPointerId) {
      return;
    }
    dragPointerId = null;
    viewport.cursor = 'grab';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endPointerDrag);
    window.removeEventListener('pointercancel', endPointerDrag);
  }
  function applyScroll(): void {
    const maxScroll = Math.max(0, text.height - boxHeight);
    scrollPx = Math.max(0, Math.min(maxScroll, scrollPx));
    text.y = -scrollPx;
    upButton.setEnabled(scrollPx > 0);
    downButton.setEnabled(scrollPx < maxScroll - 0.5);
  }

  viewport.on('pointerdown', (e: FederatedPointerEvent) => {
    if (Math.max(0, text.height - boxHeight) <= 0) {
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }
    dragPointerId = e.pointerId;
    lastDragClientY = e.nativeEvent.clientY;
    viewport.cursor = 'grabbing';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endPointerDrag);
    window.addEventListener('pointercancel', endPointerDrag);
    e.stopPropagation();
  });

  // passive:false — обязателен для preventDefault() внутри wheel-listener.
  viewport.on('wheel', (e: FederatedWheelEvent) => {
    if (Math.max(0, text.height - boxHeight) <= 0) {
      return;
    }
    e.preventDefault();
    scrollPx += e.deltaY;
    applyScroll();
    e.stopPropagation();
  }, { passive: false });

  // Кнопки прокрутки на одну строку.
  const btnBig = 64;
  const btnHalfDelta = (btnBig - 32) / 2;
  const upButton = await createUiButton({
    kind: 'up',
    x: panelWidth - 48 - btnHalfDelta,
    y: 62 - btnHalfDelta,
    width: btnBig,
    height: btnBig,
    onClick: () => scrollBy(-1),
  });
  const downButton = await createUiButton({
    kind: 'down',
    x: panelWidth - 48 - btnHalfDelta,
    y: 102 - btnHalfDelta,
    width: btnBig,
    height: btnBig,
    onClick: () => scrollBy(1),
  });

  function setMessage(next: string): void {
    text.text = next;
    scrollPx = 0;
    applyScroll();
  }
  function scrollBy(delta: number): void {
    scrollPx += delta * lineStep;
    applyScroll();
  }

  applyScroll();

  return { viewport, upButton, downButton, setMessage, scrollBy };
}

// создаёт инфо меню с выводом информации
export async function createUiWindow(
  options: CreateUiWindowOptions,
): Promise<UiWindow> {
  const width = snapPanelSizeToTileGrid(options.width ?? DEFAULT_WINDOW_WIDTH);
  const height = snapPanelSizeToTileGrid(options.height ?? DEFAULT_WINDOW_HEIGHT);
  const root = new Container() as UiWindow;
  const background = await createPanelBackground(width, height);
  const icon = new Sprite(await getIcons16Texture(options.iconName));
  const title = createGameBitmapText({
    text: options.title,
    face: 'bold',
    size: 18,
    align: 'left',
  });

  const messageBoxWidth = options.messageMaxWidth
    ?? width - WINDOW_MESSAGE_INSET_X - WINDOW_SCROLL_COLUMN_W;
  const messageBoxHeight = options.messageMaxHeight
    ?? height - WINDOW_MESSAGE_INSET_Y - WINDOW_MESSAGE_BOTTOM_RESERVE;

  const message = await setupMessageViewport(
    width,
    options.message,
    messageBoxWidth,
    messageBoxHeight,
    WINDOW_MESSAGE_FONT_SIZE,
    WINDOW_MESSAGE_LINE_STEP,
  );

  // Нижняя панель действий: cancel слева, confirm справа.
  const btnBig = 64;
  const btnHalfDelta = (btnBig - 32) / 2;
  const closeButton = await createUiButton({
    kind: 'close',
    x: width - 44 - btnHalfDelta,
    y: 10 - btnHalfDelta,
    width: btnBig,
    height: btnBig,
    onClick: options.onClose,
  });
  const cancelButton = await createUiButton({
    kind: 'close',
    x: width / 2 - 52 - btnHalfDelta,
    y: height - 48 - btnHalfDelta,
    width: btnBig,
    height: btnBig,
    onClick: options.onCancel,
  });
  const confirmButton = await createUiButton({
    kind: 'confirm',
    x: width / 2 + 20 - btnHalfDelta,
    y: height - 48 - btnHalfDelta,
    width: btnBig,
    height: btnBig,
    onClick: options.onConfirm,
  });

  root.position.set(options.x ?? 0, options.y ?? 0);
  icon.position.set(16, 14);
  icon.scale.set(2);
  title.position.set(54, 16);

  root.addChild(background);
  root.addChild(icon);
  root.addChild(title);
  root.addChild(message.viewport);
  root.addChild(closeButton);
  root.addChild(cancelButton);
  root.addChild(confirmButton);
  root.addChild(message.upButton);
  root.addChild(message.downButton);

  root.setMessage = message.setMessage;
  root.scrollBy = message.scrollBy;

  return root;
}

/**
 * Лёгкое уведомление: иконка + заголовок + тело сообщения + кнопка close.
 * Отличие от {@link createUiWindow}: нет нижней панели cancel/confirm,
 * высота по умолчанию меньше, размер шрифта сообщения настраивается.
 */
export async function createUiAlert(
  options: CreateUiAlertOptions,
): Promise<UiAlert> {
  const width = snapPanelSizeToTileGrid(options.width ?? DEFAULT_ALERT_WIDTH);
  const height = snapPanelSizeToTileGrid(options.height ?? DEFAULT_ALERT_HEIGHT);
  const root = new Container() as UiAlert;
  const background = await createPanelBackground(width, height);
  const icon = new Sprite(await getIcons16Texture(options.iconName));
  const title = createGameBitmapText({
    text: options.title,
    face: 'bold',
    size: 18,
    align: 'left',
  });

  // Размер шрифта может быть как строкой-идентификатором, так и числом —
  // нормализуем в px для расчёта шага строки (используется в scrollBy).
  const messageFontPx = resolveGameTextPx(options.messageFontSize, 9);
  const alertLineStep = Math.round(messageFontPx * 1.125);
  const messageBoxWidth = options.messageMaxWidth
    ?? width - WINDOW_MESSAGE_INSET_X - WINDOW_SCROLL_COLUMN_W;
  const messageBoxHeight = options.messageMaxHeight
    ?? height - WINDOW_MESSAGE_INSET_Y - ALERT_MESSAGE_BOTTOM_PAD;

  const message = await setupMessageViewport(
    width,
    options.message,
    messageBoxWidth,
    messageBoxHeight,
    options.messageFontSize ?? 9,
    alertLineStep,
  );

  // Только close в правом верхнем углу — alert не требует подтверждения.
  const btnBig = 64;
  const btnHalfDelta = (btnBig - 32) / 2;
  const closeButton = await createUiButton({
    kind: 'close',
    x: width - 44 - btnHalfDelta,
    y: 10 - btnHalfDelta,
    width: btnBig,
    height: btnBig,
    onClick: options.onClose,
  });

  icon.position.set(16, 14);
  icon.scale.set(2);
  title.position.set(54, 16);

  // Z-order: фон → иконка/заголовок → контент → контролы поверх.
  root.addChild(background);
  root.addChild(icon);
  root.addChild(title);
  root.addChild(message.viewport);
  root.addChild(closeButton);
  root.addChild(message.upButton);
  root.addChild(message.downButton);

  root.setMessage = message.setMessage;
  root.scrollBy = message.scrollBy;

  return root;
}
