import { Container, type Application } from 'pixi.js';

// 🎯 это «карта местности» для UI-элементов!
export type ScreenUiLayoutContext = {
  width: number;
  height: number;
  /**
   * Отступ от левого/правого края: `round(width * fracX + offsetXPx)`.
   * Задаётся в {@link CreateScreenUiSystemOptions}.
   */
  edgeInsetX: number;
  /**
   * Отступ от верхнего/нижнего края: `round(height * fracY + offsetYPx)`.
   */
  edgeInsetY: number;
};

// сдедит за отступами элементов (например при изменении разрешения экрана)
export type ScreenUiLayoutHandler = (context: ScreenUiLayoutContext) => void;

// ✨ главный пульт управления всеми UI на экране
export type ScreenUiSystem = {
  root: Container;
  modalLayer: Container;
  alertLayer: Container;
  addLayoutHandler: (handler: ScreenUiLayoutHandler) => () => void;
  layout: () => void;
  /**
   * true, если координаты в системе канваса попадают в видимое модальное окно / алерт
   * (чтобы не зумить мир колесом поверх UI).
   */
  wheelBlocksWorldAtCanvas: (canvasX: number, canvasY: number) => boolean;
  /** То же для `clientX` / `clientY` из DOM. */
  wheelBlocksWorldAtClient: (clientX: number, clientY: number) => boolean;
  destroy: () => void;
};

type CreateScreenUiSystemOptions = {
  app: Application;
  root: Container;
  /**
   * Доля ширины экрана для боковых отступов (0–1). По умолчанию ≈24px при ширине 1280.
   */
  screenEdgeInsetXFrac?: number;
  /**
   * Доля высоты экрана для вертикальных отступов. По умолчанию ≈24px при высоте 720.
   */
  screenEdgeInsetYFrac?: number;
  /** Доп. сдвиг в пикселях после долевого расчёта (подгонка под «неверное» разрешение). */
  screenEdgeInsetOffsetXPx?: number;
  screenEdgeInsetOffsetYPx?: number;
};

/** База для дефолтных долей: ~24px при 1280×720. */
const DEFAULT_EDGE_INSET_X_FRAC = 24 / 1280;
const DEFAULT_EDGE_INSET_Y_FRAC = 24 / 720;

export function createScreenUiSystem(
  options: CreateScreenUiSystemOptions,
): ScreenUiSystem {
  const modalLayer = new Container();
  const alertLayer = new Container();
  const layoutHandlers = new Set<ScreenUiLayoutHandler>();

  options.root.sortableChildren = true;
  options.root.eventMode = 'static';

  modalLayer.label = 'modalLayer';
  modalLayer.zIndex = 10;
  alertLayer.label = 'alertLayer';
  alertLayer.zIndex = 20;

  options.root.addChild(modalLayer);
  options.root.addChild(alertLayer);

  function getLayoutContext(): ScreenUiLayoutContext {
    const width = options.app.screen.width;
    const height = options.app.screen.height;
    const fracX = options.screenEdgeInsetXFrac ?? DEFAULT_EDGE_INSET_X_FRAC;
    const fracY = options.screenEdgeInsetYFrac ?? DEFAULT_EDGE_INSET_Y_FRAC;
    const offX = options.screenEdgeInsetOffsetXPx ?? 0;
    const offY = options.screenEdgeInsetOffsetYPx ?? 0;

    return {
      width,
      height,
      edgeInsetX: Math.round(width * fracX + offX),
      edgeInsetY: Math.round(height * fracY + offY),
    };
  }

  function layout(): void {
    const context = getLayoutContext();

    for (const handler of layoutHandlers) {
      handler(context);
    }
  }

  function addLayoutHandler(handler: ScreenUiLayoutHandler): () => void {
    layoutHandlers.add(handler);
    handler(getLayoutContext());

    return () => {
      layoutHandlers.delete(handler);
    };
  }

  function destroy(): void {
    layoutHandlers.clear();
    options.root.removeChildren();
  }

  // 🎯 Проверяет, попадает ли точка (координаты курсора) внутрь заданного прямоугольника (bounds)
  // 💡 Если да — значит, курсор находится над UI-элементом.
  function boundsContainCanvasPoint(
    bounds: { x: number; y: number; width: number; height: number },
    canvasX: number, // canvasX и canvasY - проверяемая точка
    canvasY: number,
  ): boolean {
    if (bounds.width <= 0 || bounds.height <= 0) {
      return false;
    }
    return (
        // проверяем: x внутри [bounds.x, bounds.x + width)?
        // и y внутри [bounds.y, bounds.y + height)?
      canvasX >= bounds.x
      && canvasX < bounds.x + bounds.width // X не выходит за пределы
      && canvasY >= bounds.y
      && canvasY < bounds.y + bounds.height
    );
  }
  // 🎯 Что она делает: Проверяет, должен ли скролл/зум мира заблокироваться,
  // потому что курсор находится над UI-элементом (модалкой или алертом).
  // Если крутишь колесо мыши над UI — мир не должен реагировать.
  function wheelBlocksWorldAtCanvas(canvasX: number, canvasY: number): boolean {
    for (const layer of [modalLayer, alertLayer]) {
      for (const child of layer.children) {
        if (!child.visible) { // игнор невидимых элементов
          continue;
        }
        const r = child.getBounds();
        if (boundsContainCanvasPoint(r, canvasX, canvasY)) {
          return true;
        }
      }
    }
    return false;
  }

  // 🔑 для внешнего мира (DOM-событий), где координаты приходят в клиентской системе.
  function wheelBlocksWorldAtClient(clientX: number, clientY: number): boolean {
    const rect = options.app.canvas.getBoundingClientRect();
    const sx = options.app.screen.width / rect.width;
    const sy = options.app.screen.height / rect.height;
    const canvasX = (clientX - rect.left) * sx;
    const canvasY = (clientY - rect.top) * sy;
    return wheelBlocksWorldAtCanvas(canvasX, canvasY);
  }

  return {
    root: options.root,
    modalLayer,
    alertLayer,
    addLayoutHandler,
    layout,
    wheelBlocksWorldAtCanvas,
    wheelBlocksWorldAtClient,
    destroy,
  };
}
