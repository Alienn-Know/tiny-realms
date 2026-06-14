/**
 * Эффект «печатной машинки» для {@link BitmapText}: побуквенно проявляет заданный текст
 * с заданным темпом и мигающим карет-курсором в конце строки.
 *
 * Особенности:
 * - Работает через `setTimeout` + `setInterval` — не требует `requestAnimationFrame`,
 *   поэтому эффект продолжает идти, когда окно в фоне/неактивно (если этому не мешает throttling браузера).
 * - Возвращает `cancel` — остановка таймеров; текст дописывается до конца.
 * - `label.text` перезаписывается на каждом шаге — это триггерит пересборку глифов в PixiJS
 *   (для больших строк может быть дорого).
 *
 * Пример:
 * ```ts
 * const cancel = startBitmapTypewriter(myBitmapText, 'Hello, world!', {
 *   msPerStep: 30,
 *   charsPerStep: 1,
 *   blinkingCaret: true,
 *   onComplete: () => console.log('done'),
 * });
 * // позже:
 * cancel();
 * ```
 */
import type { BitmapText } from 'pixi.js';

export type StartBitmapTypewriterOptions = {
  /** Пауза между шагами (мс). */
  msPerStep?: number;
  /** Сколько символов добавить за шаг (1 = классическая машинка). */
  charsPerStep?: number;
  onComplete?: () => void;
  /** Мигающий символ в конце, пока печать не закончена (есть в bitmap charset). */
  blinkingCaret?: boolean;
  caretBlinkMs?: number;
  /** По умолчанию `|` — из набора печати атласа. */
  caretChar?: string;
};

/**
 * Постепенно выставляет `label.text` из `fullText`, имитируя печатную машинку.
 * Возвращает `cancel` — остановка таймеров; текст дописывается до `fullText`.
 * 1 - куда печатать
 * 2 - что печатать
 * 3 - параметры печати
 */
export function startBitmapTypewriter(
  label: BitmapText,
  fullText: string,
  options: StartBitmapTypewriterOptions = {},
): () => void {
  // данные
  const msPerStep = options.msPerStep ?? 36;
  const charsPerStep = Math.max(1, options.charsPerStep ?? 1);
  const caretChar = options.caretChar ?? '|';
  const caretBlinkMs = options.caretBlinkMs ?? 420;
  const useCaret = options.blinkingCaret === true;

  // для внутренней работы функции
  let index = 0;
  let blinkVisible = true;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let blinkId: ReturnType<typeof setInterval> | undefined;

  const applyText = (): void => {
    const chunk = fullText.slice(0, index);
    const caret =
      useCaret && index < fullText.length && blinkVisible ? caretChar : '';
    label.text = chunk + caret;
  };

  const cancel = (): void => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    if (blinkId !== undefined) {
      clearInterval(blinkId);
      blinkId = undefined;
    }
    label.text = fullText;
  };

  const step = (): void => {
    index = Math.min(fullText.length, index + charsPerStep);
    if (index >= fullText.length) {
      if (blinkId !== undefined) {
        clearInterval(blinkId);
        blinkId = undefined;
      }
      label.text = fullText;
      options.onComplete?.();
      return;
    }
    applyText();
    timeoutId = window.setTimeout(step, msPerStep);
  };

  label.text = '';
  if (useCaret) {
    blinkId = window.setInterval(() => {
      blinkVisible = !blinkVisible;
      applyText();
    }, caretBlinkMs);
  }
  applyText();
  timeoutId = window.setTimeout(step, msPerStep);

  return cancel;
}
