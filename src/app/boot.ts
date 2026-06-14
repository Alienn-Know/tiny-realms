import { Application } from 'pixi.js';

export async function bootApplication(): Promise<Application> {
  const appRoot = document.querySelector<HTMLDivElement>('#app');
  if (!appRoot) {
    throw new Error('App root element "#app" was not found.');
  }

  const app = new Application();

  await app.init({
    resizeTo: appRoot,
    background: '#ffffff',
    roundPixels: true,
    resolution: Math.min(3, window.devicePixelRatio || 1),
    autoDensity: true,
  });

  appRoot.appendChild(app.canvas);

  return app;
}
