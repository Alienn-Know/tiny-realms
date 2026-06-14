import type { Application, FederatedPointerEvent } from 'pixi.js';
import { Container, Rectangle, Sprite } from 'pixi.js';
import { getUiMiniAtlasRegion } from '../../assets/uiMiniAtlas';
import { createGameBitmapText } from '../fonts/gameBitmapText';

export type Point = { x: number; y: number };

export type AttachCanvasContextMenuOptions = {
  app: Application;
  /** Корень экранного UI (например `screenUi.root`). */
  parent: Container;
  screenToCanvasPoint: (clientX: number, clientY: number) => Point;
  /**
   * Корень мира (`stage` → world): двойной тап по «пустому» месту открывает то же меню, что и ПКМ.
   * Не срабатывает при взаимодействии с иконками предметов и их панелями (см. слои ниже).
   */
  world?: Container;
  /** Слой иконок предметов — двойной клик по ним не открывает меню. */
  iconsLayer?: Container;
  /** Слой карточек информации — то же. */
  itemInfoLayer?: Container;
};

/** Регион фона в `pixel-assets/ui/ui_mini_atlas.png`. */
const CONTEXT_MENU_BG_X = 0;
const CONTEXT_MENU_BG_Y = 80;
const CONTEXT_MENU_BG_W = 64;
const CONTEXT_MENU_BG_H = 48;
/** Масштаб спрайта фона и логических размеров панели (64×48 → экран). */
const MENU_SCALE = 4;
const MENU_Z_INDEX = 30;

const MENU_ITEMS = [
  'Включить отдалку',
  'Информация об объекте',
  'Удалить объект',
] as const;

const DOUBLE_TAP_MAX_DELAY_MS = 350;
const DOUBLE_TAP_MAX_DISTANCE = 24;

// содержат ли layers объект target
function isTargetUnderAnyLayer(target: Container, layers: Container[]): boolean {
  for (let t: Container | null = target; t; t = t.parent as Container | null) {
    if (layers.includes(t)) {
      return true;
    }
  }
  return false;
}

function simulateMenuItemAction(index: number): void {
  switch (index) {
    case 0:
      console.log('[context menu] Включить отдалку (заглушка)');
      break;
    case 1:
      console.log('[context menu] Информация об объекте (заглушка)');
      break;
    case 2:
      console.log('[context menu] Удалить объект (заглушка)');
      break;
    default:
      break;
  }
}

/**
 * ПКМ по канвасу — показать меню в точке курсора.
 * ПКМ снова (контекстное меню) — только закрыть.
 * ЛКМ вне меню — закрыть; ЛКМ по пункту — выбор и закрытие.
 * Перетаскивание с зажатой кнопкой (`pointermove` при `buttons !== 0`) — закрыть.
 * Двойной тап по пустому месту мира (см. опции `world` / слои) — то же, что ПКМ.
 */
export async function attachCanvasContextMenu(
  options: AttachCanvasContextMenuOptions,
): Promise<() => void> {
  const { app, parent, screenToCanvasPoint, world, iconsLayer, itemInfoLayer } =
    options;

  const menuRoot = new Container();
  menuRoot.visible = false;
  menuRoot.zIndex = MENU_Z_INDEX;
  menuRoot.eventMode = 'static';

  const bgTexture = await getUiMiniAtlasRegion(
    CONTEXT_MENU_BG_X,
    CONTEXT_MENU_BG_Y,
    CONTEXT_MENU_BG_W,
    CONTEXT_MENU_BG_H,
  );
  const bg = new Sprite(bgTexture);
  bg.scale.set(MENU_SCALE);

  const panelW = CONTEXT_MENU_BG_W * MENU_SCALE;
  const panelH = CONTEXT_MENU_BG_H * MENU_SCALE;
  menuRoot.hitArea = new Rectangle(0, 0, panelW, panelH);

  menuRoot.addChild(bg);

  let y = 16;
  MENU_ITEMS.forEach((label, index) => {
    const row = createGameBitmapText({
      text: label,
      face: 'sans',
      size: 'body',
      align: 'left',
    });
    row.position.set(20, y);
    row.eventMode = 'static';
    row.cursor = 'pointer';
    row.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      hide();
      simulateMenuItemAction(index);
    });
    menuRoot.addChild(row);
    y += 24;
  });

  parent.addChild(menuRoot);

  let menuOpen = false;
  /** Закрытие по ПКМ: иначе следом придёт `contextmenu` и снова откроет меню. */
  let ignoreNextContextMenu = false;

  // при клике снизу или справа экрана, не дает вылезть из области видимости
  function clampMenuPosition(): void {
    const sw = app.screen.width;
    const sh = app.screen.height;
    menuRoot.position.x = Math.max(0, Math.min(menuRoot.position.x, sw - panelW));
    menuRoot.position.y = Math.max(0, Math.min(menuRoot.position.y, sh - panelH));
  }

  // показать меню (в канвасе)
  function showAtCanvas(canvasX: number, canvasY: number): void {
    menuRoot.position.set(canvasX, canvasY);
    clampMenuPosition();
    menuRoot.visible = true;
    menuOpen = true;
  }

  // показать меню (на экране) -> вызывает канвас
  function showAtClient(clientX: number, clientY: number): void {
    const p = screenToCanvasPoint(clientX, clientY);
    showAtCanvas(p.x, p.y);
  }

  function hide(): void {
    menuRoot.visible = false;
    menuOpen = false;
  }

  const onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    if (ignoreNextContextMenu) {
      ignoreNextContextMenu = false;
      return;
    }
    if (menuOpen) {
      hide();
      return;
    }
    showAtClient(e.clientX, e.clientY);
  };

  const onPointerDownCapture = (e: PointerEvent): void => {
    if (!menuOpen) {
      return;
    }
    if (e.button === 0) { // попадание кликом по меню которое (могло бы вылезти из экрана)
      const p = screenToCanvasPoint(e.clientX, e.clientY);
      const mx = menuRoot.position.x;
      const my = menuRoot.position.y;
      if (
        p.x >= mx
        && p.x < mx + panelW
        && p.y >= my
        && p.y < my + panelH
      ) {
        return;
      }
      hide();
      return;
    }
    if (e.button === 2) {
      hide();
      ignoreNextContextMenu = true;
    }
  };

  const onPointerMoveCapture = (e: PointerEvent): void => {
    if (!menuOpen || e.buttons === 0) {
      return;
    }
    hide();
  };

  // удаление отсутствующих элементов из массива
  const blockLayers = [iconsLayer, itemInfoLayer].filter(
    (c): c is Container => c != null,
  );

  let lastWorldTap: {
    time: number;
    x: number;
    y: number;
    pointerType: string;
  } | null = null;

  let previousWorldEventMode: Container['eventMode'] | undefined;

  const onWorldPointerTap = (e: FederatedPointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }
    if (blockLayers.length > 0) {
      const target = e.target as Container;
      if (isTargetUnderAnyLayer(target, blockLayers)) {
        return;
      }
    }

    const now = performance.now();
    const tapX = e.global.x;
    const tapY = e.global.y;
    const isSamePointerType = lastWorldTap?.pointerType === e.pointerType;
    const isQuickEnough =
      lastWorldTap !== null && now - lastWorldTap.time <= DOUBLE_TAP_MAX_DELAY_MS;
    const isCloseEnough =
      lastWorldTap !== null
      && Math.hypot(tapX - lastWorldTap.x, tapY - lastWorldTap.y)
      <= DOUBLE_TAP_MAX_DISTANCE;

    if (isSamePointerType && isQuickEnough && isCloseEnough) {
      lastWorldTap = null;
      showAtCanvas(tapX, tapY);
      return;
    }

    lastWorldTap = {
      time: now,
      x: tapX,
      y: tapY,
      pointerType: e.pointerType,
    };
  };

  app.canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('pointerdown', onPointerDownCapture, true);
  window.addEventListener('pointermove', onPointerMoveCapture, true);

  if (world) {
    previousWorldEventMode = world.eventMode;
    world.eventMode = 'static';
    world.on('pointertap', onWorldPointerTap);
  }

  return () => {
    app.canvas.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('pointerdown', onPointerDownCapture, true);
    window.removeEventListener('pointermove', onPointerMoveCapture, true);
    if (world) {
      world.off('pointertap', onWorldPointerTap);
      if (previousWorldEventMode !== undefined) {
        world.eventMode = previousWorldEventMode;
      }
    }
    hide();
    parent.removeChild(menuRoot);
  };
}
