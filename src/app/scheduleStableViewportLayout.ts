/**
 * Мобильные браузеры при смене ориентации шлют несколько `resize` с промежуточными
 * размерами; один RAF до обновления Pixi даёт устаревший `app.screen`. Дебаунс +
 * двойной RAF откладывают лейаут до стабильных размеров.
 * 2 вызова кода, 1 до отрисовки и 1 после отрисовки
 */
const DEBOUNCE_MS = 50;

export type StableViewportLayoutOptions = {
  onLayout: () => void;
};

export function attachStableViewportLayout(
  options: StableViewportLayoutOptions,
): () => void {
  let debounceId: ReturnType<typeof setTimeout> | undefined;
  let raf1 = 0;
  let raf2 = 0;

  //запуск переотрисовки
  function runLayout(): void {
    cancelAnimationFrame(raf1);
    cancelAnimationFrame(raf2);
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        options.onLayout();
      });
    });
  }

  //запрос переотрисовки
  function requestReflow(): void {
    if (debounceId !== undefined) {
      clearTimeout(debounceId);
    }
    debounceId = window.setTimeout(() => {
      debounceId = undefined;
      runLayout();
    }, DEBOUNCE_MS);
  }

  // при растяжении экрана
  const onResize = (): void => {
    requestReflow();
  };


  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  // для телефонов и планшетов
  const visualViewport = window.visualViewport;
  if (visualViewport) {
    visualViewport.addEventListener('resize', onResize);
  }

  return () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    if (visualViewport) {
      visualViewport.removeEventListener('resize', onResize);
    }
    if (debounceId !== undefined) {
      clearTimeout(debounceId);
    }
    cancelAnimationFrame(raf1);
    cancelAnimationFrame(raf2);
  };
}
