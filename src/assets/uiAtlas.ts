import { Assets, Rectangle, Texture } from 'pixi.js';
import uiAtlasUrl from '../../pixel-assets/ui/UI books & more.png';

type UiFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// от какой точки вырезать ножницами спрайт из атласа
export const uiFrames = {
  notebookPage: {
    x: 512,
    y: 16,
    width: 48,
    height: 64,
  },
} satisfies Record<string, UiFrame>;

export type UiFrameName = keyof typeof uiFrames;

let atlasTexturePromise: Promise<Texture> | undefined;

// загрузка атласа со спрайтами
async function loadUiAtlas(): Promise<Texture> {
  if (!atlasTexturePromise) {
    atlasTexturePromise = Assets.load(uiAtlasUrl).then((texture) => {
      const atlasTexture = texture as Texture;

      // Keep atlas scaling crisp for pixel-art sprites.
      atlasTexture.source.scaleMode = 'nearest';
      return atlasTexture;
    });
  }

  return atlasTexturePromise;
}

// вырезание заготовленного спрайта из атласа
export async function getUiTexture(frameName: UiFrameName): Promise<Texture> {
  const frame = uiFrames[frameName];
  const atlasTexture = await loadUiAtlas();

  // Create a sub-texture from the shared atlas using the frame rectangle.
  return new Texture({
    source: atlasTexture.source,
    frame: new Rectangle(frame.x, frame.y, frame.width, frame.height),
  });
}
