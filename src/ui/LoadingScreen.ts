import { Container, Text, TextStyle } from 'pixi.js';

/**
 * 📺 LoadingScreen — простой экран загрузки с прогрессом.
 *
 * Показывается сразу после создания Application и скрывается,
 * когда все ассеты загружены.
 */
export class LoadingScreen {
  readonly container = new Container();
  #text: Text;

  constructor(appW: number, appH: number) {
    this.#text = new Text({
      text: 'Loading… 0%',
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 24,
        fill: 0xffffff,
      }),
    });
    this.#text.anchor.set(0.5);
    this.#text.position.set(appW / 2, appH / 2);
    this.container.addChild(this.#text);
  }

  /** Обновить прогресс (0..1). */
  setProgress(p: number): void {
    this.#text.text = `Loading… ${Math.round(p * 100)}%`;
  }

  /** Удалить экран загрузки. */
  destroy(): void {
    this.container.removeFromParent();
    this.container.destroy({ children: true });
  }
}
