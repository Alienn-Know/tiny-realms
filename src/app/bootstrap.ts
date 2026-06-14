import { Application } from 'pixi.js';

export async function createApp(canvasContainer: HTMLElement): Promise<Application> {
  const app = new Application();

  await app.init({
    background: '#1a1a2e',
    resizeTo: window,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  canvasContainer.appendChild(app.canvas);
  return app;
}
