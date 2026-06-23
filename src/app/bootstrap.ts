import {Application, TextureStyle} from 'pixi.js';

export async function createApp(container: HTMLElement): Promise<Application> {
  const app = new Application();

  TextureStyle.defaultOptions.scaleMode = 'nearest'

  await app.init({
    resizeTo: window,
    antialias: false,
    roundPixels: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  container.appendChild(app.canvas);
  app.ticker.stop();
  return app;
}
