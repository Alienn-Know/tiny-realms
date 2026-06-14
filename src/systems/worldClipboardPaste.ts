import type { Application, Container } from 'pixi.js';
import { createGameBitmapText } from '../features/fonts/gameBitmapText';

export type AttachWorldClipboardPasteOptions = {
  app: Application;
  world: Container;
  screenToCanvasPoint: (screenX: number, screenY: number) => { x: number; y: number };
  getWorldPoint: (canvasX: number, canvasY: number) => { x: number; y: number };
  /** true — не вставлять в мир (например курсор над экранным UI). */
  isPasteBlockedAtClient: (clientX: number, clientY: number) => boolean;
  /** Перенос длинных строк вставленного текста. */
  pasteMaxWidth?: number;
};

function isDomTextFieldFocused(): boolean {
  const el = document.activeElement;
  if (!el || el === document.body) {
    return false;
  }
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  if (el instanceof HTMLElement && el.isContentEditable) {
    return true;
  }
  return false;
}

/**
 * Вставка из буфера обмена в мир: только DOM `paste` + координаты с канваса Pixi, без input/textarea.
 */
export function attachWorldClipboardPaste(
  options: AttachWorldClipboardPasteOptions,
): () => void {
  const pasteMaxWidth = options.pasteMaxWidth ?? 400;
  let lastClientX = 0;
  let lastClientY = 0;
  let hasPointerSample = false;

  function samplePointer(clientX: number, clientY: number): void {
    lastClientX = clientX;
    lastClientY = clientY;
    hasPointerSample = true;
  }

  const onCanvasPointerMove = (e: PointerEvent): void => {
    samplePointer(e.clientX, e.clientY);
  };

  const onCanvasPointerDown = (e: PointerEvent): void => {
    samplePointer(e.clientX, e.clientY);
  };

  const onPaste = (e: ClipboardEvent): void => {
    if (isDomTextFieldFocused()) {
      return;
    }

    const raw = e.clipboardData?.getData('text/plain') ?? '';
    const text = raw.replace(/\r\n/g, '\n').trimEnd();
    if (!text) {
      return;
    }

    const rect = options.app.canvas.getBoundingClientRect();
    const centerClientX = rect.left + rect.width / 2;
    const centerClientY = rect.top + rect.height / 2;
    const clientX = hasPointerSample ? lastClientX : centerClientX;
    const clientY = hasPointerSample ? lastClientY : centerClientY;

    if (options.isPasteBlockedAtClient(clientX, clientY)) {
      return;
    }

    e.preventDefault();

    const canvasPt = options.screenToCanvasPoint(clientX, clientY);
    const worldPt = options.getWorldPoint(canvasPt.x, canvasPt.y);

    const label = createGameBitmapText({
      text,
      face: 'sans',
      size: 'body',
      maxWidth: pasteMaxWidth,
      align: 'left',
    });
    label.position.set(worldPt.x, worldPt.y);
    options.world.addChild(label);
  };

  options.app.canvas.addEventListener('pointermove', onCanvasPointerMove);
  options.app.canvas.addEventListener('pointerdown', onCanvasPointerDown);
  window.addEventListener('paste', onPaste);

  return () => {
    options.app.canvas.removeEventListener('pointermove', onCanvasPointerMove);
    options.app.canvas.removeEventListener('pointerdown', onCanvasPointerDown);
    window.removeEventListener('paste', onPaste);
  };
}
