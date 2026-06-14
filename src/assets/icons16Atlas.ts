import { Assets, Rectangle, Texture } from 'pixi.js';
import icons16Url from '../../pixel-assets/ui/16x16.png';

/** Размер одной клетки в атласе (PNG — сетка 16×16). */
export const ICONS16_CELL = 16;

/**
 * Кадры заданы как (col, row) в сетке: x = col * 16, y = row * 16.
 * Лист ~10 колонок; при неверной иконке поправь col/row под свой PNG.
 */
export const icons16Frames = {
  apple: { col: 2, row: 19 },
  grapes: { col: 3, row: 19 },
  watermelon: { col: 4, row: 19 },
  potionRed: { col: 0, row: 7 },
  scroll: { col: 5, row: 8 },
  swordSteel: { col: 1, row: 25 },
  shieldSmall: { col: 2, row: 25 },
  gemBlue: { col: 7, row: 6 },
} as const;

export type Icons16Name = keyof typeof icons16Frames;

let atlasTexturePromise: Promise<Texture> | undefined;

async function loadIcons16Atlas(): Promise<Texture> {
  if (!atlasTexturePromise) {
    atlasTexturePromise = Assets.load(icons16Url).then((texture) => {
      const atlasTexture = texture as Texture;
      atlasTexture.source.scaleMode = 'nearest';
      return atlasTexture;
    });
  }

  return atlasTexturePromise;
}

// получить текстуру по названию предмета
export async function getIcons16Texture(name: Icons16Name): Promise<Texture> {
  const frame = icons16Frames[name];
  const atlas = await loadIcons16Atlas();

  return new Texture({
    source: atlas.source,
    frame: new Rectangle(
      frame.col * ICONS16_CELL,
      frame.row * ICONS16_CELL,
      ICONS16_CELL,
      ICONS16_CELL,
    ),
  });
}
