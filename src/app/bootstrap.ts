import {Application, extensions, TextureStyle} from 'pixi.js';
import { tiledMapLoader } from 'pixi-tiledmap';

let tiledExtensionRegistered = false;

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

  if (!tiledExtensionRegistered) {
    extensions.add(tiledMapLoader);
    tiledExtensionRegistered = true;
  }

  container.appendChild(app.canvas);
  app.ticker.stop();
  return app;
}
