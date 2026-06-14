import { Assets, Rectangle, Texture } from 'pixi.js';
import uiMiniAtlasUrl from '../../pixel-assets/ui/ui_mini_atlas.png';

export const UI_MINI_CELL = 16;
export const UI_BUTTON_FRAME_SIZE = 32;

// класс загрузки спрайтов для GUI
const uiMiniFrames = {
  confirmIdle: { col: 0, row: 0 },
  confirmPressed: { col: 1, row: 0 },
  panelTopLeft: { col: 2, row: 0 },
  panelTop: { col: 3, row: 0 },
  panelTopRight: { col: 4, row: 0 },
  closeIdle: { col: 0, row: 1 },
  closePressed: { col: 1, row: 1 },
  panelLeft: { col: 2, row: 1 },
  panelCenter: { col: 3, row: 1 },
  panelRight: { col: 4, row: 1 },
  upIdle: { col: 0, row: 2 },
  upPressed: { col: 1, row: 2 },
  panelBottomLeft: { col: 2, row: 2 },
  panelBottom: { col: 3, row: 2 },
  panelBottomRight: { col: 4, row: 2 },
  buttonFrame: { col: 2, row: 3, width: UI_BUTTON_FRAME_SIZE, height: UI_BUTTON_FRAME_SIZE },
} as const;

export type UiMiniFrameName = keyof typeof uiMiniFrames;

let atlasTexturePromise: Promise<Texture> | undefined;
const frameTexturePromises = new Map<UiMiniFrameName, Promise<Texture>>();

async function loadUiMiniAtlas(): Promise<Texture> {
  if (!atlasTexturePromise) {
    atlasTexturePromise = Assets.load(uiMiniAtlasUrl).then((texture) => {
      const atlasTexture = texture as Texture;

      atlasTexture.source.scaleMode = 'nearest';
      return atlasTexture;
    });
  }

  return atlasTexturePromise;
}

// загружает текстуру из атласа из выбранной размеченной ячейки
export async function getUiMiniTexture(
  frameName: UiMiniFrameName,
): Promise<Texture> {
  const existingTexture = frameTexturePromises.get(frameName);

  if (existingTexture) {
    return existingTexture;
  }

  const texturePromise = loadUiMiniAtlas().then((atlasTexture) => {
    const frame = uiMiniFrames[frameName];

    return new Texture({
      source: atlasTexture.source,
      frame: new Rectangle(
        frame.col * UI_MINI_CELL,
        frame.row * UI_MINI_CELL,
        'width' in frame ? frame.width : UI_MINI_CELL,
        'height' in frame ? frame.height : UI_MINI_CELL,
      ),
    });
  });

  frameTexturePromises.set(frameName, texturePromise);
  return texturePromise;
}

/** Произвольный прямоугольник атласа `ui_mini_atlas.png` (пиксели исходника). */
export async function getUiMiniAtlasRegion(
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<Texture> {
  const atlasTexture = await loadUiMiniAtlas();
  return new Texture({
    source: atlasTexture.source,
    frame: new Rectangle(x, y, width, height),
  });
}
