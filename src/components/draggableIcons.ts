import type { FederatedPointerEvent } from 'pixi.js';
import { Container, Sprite } from 'pixi.js';
import { snapToNearestStep } from '../utils/math';

/*
* Файл для перетягиваемых предметов, ЛКМ и потянул
* */
type Point = { x: number; y: number };
type DragCallback = (sprite: Sprite) => void;
type BindDraggableSpriteOptions = {
  stackParent?: Container;
  onDragStart?: DragCallback;
  onDragMove?: DragCallback;
  onDragEnd?: DragCallback;
  onDoubleClick?: DragCallback;
};
type TapState = {
  time: number;
  x: number;
  y: number;
  pointerType: string;
};

const DOUBLE_TAP_MAX_DELAY_MS = 350;
const DOUBLE_TAP_MAX_DISTANCE = 24;

/**
 * ЛКМ: перетаскивание в координатах `world`.
 * Если передан `stackParent`, при начале перетаскивания спрайт снова добавляется
 * в этого родителя последним — рисуется поверх остальных детей того же контейнера.
 */
export function bindDraggableSprite(
  sprite: Sprite,
  screenToCanvasPoint: (screenX: number, screenY: number) => Point,
  getWorldPoint: (canvasX: number, canvasY: number) => Point,
  options: BindDraggableSpriteOptions = {},
): void {
  let drag: { ox: number; oy: number } | null = null;
  let lastTap: TapState | null = null;
  const snapStepX = Math.abs(sprite.scale.x) || 1;
  const snapStepY = Math.abs(sprite.scale.y) || 1;

  sprite.eventMode = 'static';
  sprite.cursor = 'pointer';

  sprite.on('pointerdown', (e: FederatedPointerEvent) => {
    if (e.button !== 0) {
      return;
    }

    e.stopPropagation();

    if (options.stackParent) {
      options.stackParent.addChild(sprite);
    }

    const wp = getWorldPoint(e.global.x, e.global.y);
    drag = { ox: wp.x - sprite.x, oy: wp.y - sprite.y }; // спрайт остаётся на том же месте относительно курсора, где его кликнули.
    options.onDragStart?.(sprite);

    const pointerId = e.pointerId;

    const onPointerMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId || !drag) {
        return;
      }

      const cp = screenToCanvasPoint(ev.clientX, ev.clientY);
      const w = getWorldPoint(cp.x, cp.y);
      sprite.position.set(
        w.x - drag.ox,
        w.y - drag.oy,
      );
      options.onDragMove?.(sprite);
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) {
        return;
      }

      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      sprite.position.set(  // установка спрайта в нужную округленную по сетке точку (при отпускании клавиши)
        snapToNearestStep(sprite.x, snapStepX),
        snapToNearestStep(sprite.y, snapStepY),
      );
      options.onDragEnd?.(sprite);
      drag = null;
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  });

  sprite.on('pointertap', (e: FederatedPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }

    const now = performance.now();
    const tapX = e.global.x;
    const tapY = e.global.y;
    const isSamePointerType = lastTap?.pointerType === e.pointerType;
    const isQuickEnough = lastTap !== null && now - lastTap.time <= DOUBLE_TAP_MAX_DELAY_MS;
    const isCloseEnough = lastTap !== null
      && Math.hypot(tapX - lastTap.x, tapY - lastTap.y) <= DOUBLE_TAP_MAX_DISTANCE;

    if (isSamePointerType && isQuickEnough && isCloseEnough) {
      lastTap = null;
      e.stopPropagation();
      options.onDoubleClick?.(sprite);
      return;
    }

    lastTap = {
      time: now,
      x: tapX,
      y: tapY,
      pointerType: e.pointerType,
    };

    e.stopPropagation();
  });
}
