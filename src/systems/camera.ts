import type { Application, Container } from 'pixi.js';

export type Point = {
  x: number;
  y: number;
};

type PanState = {
  active: boolean;
  startPointerX: number;
  startPointerY: number;
  startWorldX: number;
  startWorldY: number;
};

type TouchGestureState = {
  active: boolean;
  startCenterX: number;
  startCenterY: number;
  startDistance: number;
  startRawScale: number;
  startWorldX: number;
  startWorldY: number;
  startScale: number;
};

type CreateCameraSystemOptions = {
  app: Application;
  world: Container;
  zoomSnapFactor: number;
  originalZoom: number;
  minZoom: number;
  maxZoom: number;
  wheelZoomStep: number;
  /**
   * Если вернёт true, камера не реагирует на зум (колесо, pinch) в этой точке экрана.
   * Координаты — `clientX` / `clientY` (DOM), как у `WheelEvent` и центра жеста из `TouchEvent`.
   */
  shouldSuppressCameraAtClient?: (clientX: number, clientY: number) => boolean;
};

export type CameraSystem = {
  screenToCanvasPoint: (screenX: number, screenY: number) => Point;
  getWorldPoint: (canvasX: number, canvasY: number, scale?: number) => Point;
  mount: () => void;
  destroy: () => void;
  resnapWorldScalePreserveScreenCenter: () => void;
};

export function createCameraSystem(
  options: CreateCameraSystemOptions,
): CameraSystem {
  const panState: PanState = {
    active: false,
    startPointerX: 0,
    startPointerY: 0,
    startWorldX: 0,
    startWorldY: 0,
  };
  const touchGestureState: TouchGestureState = {
    active: false,
    startCenterX: 0,
    startCenterY: 0,
    startDistance: 0,
    startRawScale: options.originalZoom,
    startWorldX: 0,
    startWorldY: 0,
    startScale: options.originalZoom,
  };
  let rawScale = options.originalZoom;
  // ограничение масштаба
  function clampZoom(scale: number): number {
    return Math.max(options.minZoom, Math.min(options.maxZoom, scale));
  }

  // округление числа
  function snapWorldScaleForCrispTexels(rawScale: number): number {
    const clamped = clampZoom(rawScale);
    const resolution = options.app.renderer.resolution || 1;
    const x = options.zoomSnapFactor * resolution;
    if (x <= 0) {
      return clamped; // тут сразу целое и округлённое
    }

    const n = Math.max(1, Math.round(x * clamped)); // округляется
    return clampZoom(n / x); // делится и округляется
  }

  //округляет позицию экрана к сетке физических пикселей (что бы пиксели были квадратными всегда)
  function snapScreenPositionToFramebuffer(value: number): number {
    const resolution = options.app.renderer.resolution || 1;
    return Math.round(value * resolution) / resolution;
  }


  // установка позиции к округлённым пикселям фреймбуфера
  function setWorldPosition(x: number, y: number): void {
    options.world.position.set(
      snapScreenPositionToFramebuffer(x),
      snapScreenPositionToFramebuffer(y),
    );
  }

  function setWorldPositionSmooth(x: number, y: number): void {
    options.world.position.set(x, y);
  }

  //меняет масштаб но не дает камере уехать
  function resnapWorldScalePreserveScreenCenter(): void {
    const anchorX = options.app.screen.width / 2;
    const anchorY = options.app.screen.height / 2;
    const worldX = (anchorX - options.world.x) / options.world.scale.x;
    const worldY = (anchorY - options.world.y) / options.world.scale.y;
    const snapped = snapWorldScaleForCrispTexels(rawScale);

    rawScale = clampZoom(rawScale);
    options.world.scale.set(snapped);
    setWorldPosition(
      anchorX - worldX * snapped,
      anchorY - worldY * snapped,
    );
  }

  //координаты скрина -> координаты канваса
  function screenToCanvasPoint(screenX: number, screenY: number): Point {
    const rect = options.app.canvas.getBoundingClientRect();
    const sx = options.app.screen.width / rect.width;
    const sy = options.app.screen.height / rect.height;

    return {
      x: (screenX - rect.left) * sx,
      y: (screenY - rect.top) * sy,
    };
  }

  // канвас кординаты -> мировые кординаты
  function getWorldPoint(
    canvasX: number,
    canvasY: number,
    scale = options.world.scale.x,
  ): Point {
    return {
      x: (canvasX - options.world.x) / scale,
      y: (canvasY - options.world.y) / scale,
    };
  }

  // применяет зум (snappedScale) и (уст. мир коорды)
  function applyZoom(nextScale: number, screenX: number, screenY: number): void {
    rawScale = clampZoom(nextScale);
    const snappedScale = snapWorldScaleForCrispTexels(rawScale);
    const canvasPoint = screenToCanvasPoint(screenX, screenY);
    const worldPoint = getWorldPoint(canvasPoint.x, canvasPoint.y);

    options.world.scale.set(snappedScale);
    setWorldPosition(
      canvasPoint.x - worldPoint.x * snappedScale,
      canvasPoint.y - worldPoint.y * snappedScale,
    );
  }

  //начинание перетягивания Pan
  function startPan(screenX: number, screenY: number): void {
    const canvasPoint = screenToCanvasPoint(screenX, screenY);

    panState.active = true;
    panState.startPointerX = canvasPoint.x;
    panState.startPointerY = canvasPoint.y;
    panState.startWorldX = options.world.x;
    panState.startWorldY = options.world.y;

    options.app.canvas.style.cursor = 'grabbing';
  }

  // сдвигает Pan относительно стартовых координат startPan каждый раз пересчитывает
  // относительно первой замеренной точки
  function updatePan(screenX: number, screenY: number): void {
    const canvasPoint = screenToCanvasPoint(screenX, screenY);
    const deltaX = canvasPoint.x - panState.startPointerX;
    const deltaY = canvasPoint.y - panState.startPointerY;

    setWorldPositionSmooth(
      panState.startWorldX + deltaX,
      panState.startWorldY + deltaY,
    );
  }

  function getTwoTouches(touches: TouchList): [Touch, Touch] {
    const firstTouch = touches.item(0);
    const secondTouch = touches.item(1);

    if (!firstTouch || !secondTouch) {
      throw new Error('Two touches are required for this gesture.');
    }

    return [firstTouch, secondTouch];
  }

  // средина между двумя тыкнутыми точками
  function getTouchCenter(touches: TouchList): Point {
    const [firstTouch, secondTouch] = getTwoTouches(touches);

    return {
      x: (firstTouch.clientX + secondTouch.clientX) / 2,
      y: (firstTouch.clientY + secondTouch.clientY) / 2,
    };
  }

  // расстояние от начальной точки до конечной (как линейка)
  function getTouchDistance(touches: TouchList): number {
    const [firstTouch, secondTouch] = getTwoTouches(touches);
    const deltaX = secondTouch.clientX - firstTouch.clientX;
    const deltaY = secondTouch.clientY - firstTouch.clientY;

    return Math.hypot(deltaX, deltaY);
  }

  // запуск двухпальцевого жеста
  function startTouchGesture(touches: TouchList): void {
    const touchCenter = getTouchCenter(touches);
    const canvasPoint = screenToCanvasPoint(touchCenter.x, touchCenter.y);

    touchGestureState.active = true;
    touchGestureState.startCenterX = canvasPoint.x;
    touchGestureState.startCenterY = canvasPoint.y;
    touchGestureState.startDistance = getTouchDistance(touches);
    touchGestureState.startRawScale = rawScale;
    touchGestureState.startWorldX = options.world.x;
    touchGestureState.startWorldY = options.world.y;
    touchGestureState.startScale = options.world.scale.x;

    startPan(touchCenter.x, touchCenter.y);
  }

  // обновление двухпальцевого жеста (мировая позиция + масштабирование)
  function updateTouchGesture(touches: TouchList): void {
    const touchCenter = getTouchCenter(touches);
    const canvasPoint = screenToCanvasPoint(touchCenter.x, touchCenter.y);
    const currentDistance = getTouchDistance(touches);
    const distanceRatio = touchGestureState.startDistance > 0 // дистанция уменьшилась - сжатие, увеличилась - расширение
      ? currentDistance / touchGestureState.startDistance
      : 1;
    rawScale = clampZoom(touchGestureState.startRawScale * distanceRatio);
    const nextScale = snapWorldScaleForCrispTexels(rawScale);
    const anchorWorldPoint = {
      x: (touchGestureState.startCenterX - touchGestureState.startWorldX)
        / touchGestureState.startScale,
      y: (touchGestureState.startCenterY - touchGestureState.startWorldY)
        / touchGestureState.startScale,
    };

    options.world.scale.set(nextScale);
    setWorldPositionSmooth(
      canvasPoint.x - anchorWorldPoint.x * nextScale,
      canvasPoint.y - anchorWorldPoint.y * nextScale,
    );
  }

  // завершение перетягивания (стоп)
  function endPan(): void {
    if (!panState.active) {
      return;
    }

    panState.active = false;
    options.app.canvas.style.cursor = 'default';
    // 🎯 Финальный snap к чётким пикселям!
    setWorldPosition(options.world.x, options.world.y);
  }

  // нажато колесико - ВКЛ перетягивание
  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 1) {
      return;
    }

    event.preventDefault();
    startPan(event.clientX, event.clientY);
  };

  // режим перетягивания
  const onMouseMove = (event: MouseEvent) => {
    if (!panState.active) {
      return;
    }

    updatePan(event.clientX, event.clientY);
  };

  // завершение перетягивания
  const onMouseUp = (event: MouseEvent) => {
    if (event.button === 1) {
      endPan();
    }
  };

  // вращение колёсика мыши
  const onWheel = (event: WheelEvent) => {
    if (options.shouldSuppressCameraAtClient?.(event.clientX, event.clientY)) {
      return;
    }

    event.preventDefault();

    const zoomFactor = Math.exp(-event.deltaY * options.wheelZoomStep);
    applyZoom(rawScale * zoomFactor, event.clientX, event.clientY);
  };

  // средняя кнопка - 🚫 отмена стандартного поведения
  const onAuxClick = (event: MouseEvent) => {
    if (event.button === 1) {
      event.preventDefault();
    }
  };

  // запуск двухпальцевого жеста (аналогично мыши onMouseDown)
  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 2) {
      return;
    }

    const center = getTouchCenter(event.touches);
    if (options.shouldSuppressCameraAtClient?.(center.x, center.y)) {
      return;
    }

    event.preventDefault();
    startTouchGesture(event.touches);
  };

  // жест перетягивания (аналогично мыши onMouseMove)
  const onTouchMove = (event: TouchEvent) => {
    if (!touchGestureState.active || event.touches.length !== 2) {
      return;
    }

    const center = getTouchCenter(event.touches);
    if (options.shouldSuppressCameraAtClient?.(center.x, center.y)) {
      touchGestureState.active = false;
      endPan();
      return;
    }

    event.preventDefault();
    updateTouchGesture(event.touches);
  };

  // жест завершения (аналогично мыши onMouseUp)
  const onTouchEnd = () => {
    touchGestureState.active = false;
    endPan();
  };

  function mount(): void {
    options.app.canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', endPan); // 'blur' -> это окно больше неактивно 😱 (выкл перетягивание) на всякий случай
    options.app.canvas.addEventListener('wheel', onWheel, { passive: false });
    options.app.canvas.addEventListener('auxclick', onAuxClick);
    options.app.canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    options.app.canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    options.app.canvas.addEventListener('touchend', onTouchEnd);
    options.app.canvas.addEventListener('touchcancel', onTouchEnd);
  }

  function destroy(): void {
    options.app.canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('blur', endPan);
    options.app.canvas.removeEventListener('wheel', onWheel);
    options.app.canvas.removeEventListener('auxclick', onAuxClick);
    options.app.canvas.removeEventListener('touchstart', onTouchStart);
    options.app.canvas.removeEventListener('touchmove', onTouchMove);
    options.app.canvas.removeEventListener('touchend', onTouchEnd);
    options.app.canvas.removeEventListener('touchcancel', onTouchEnd);
  }

  return {
    screenToCanvasPoint,
    getWorldPoint,
    mount,
    destroy,
    resnapWorldScalePreserveScreenCenter,
  };
}
