import { BitmapFont, BitmapText } from 'pixi.js';
import pixeloidSansUrl from '../../../pixel-assets/fonts/PixeloidSans-lxa3y.ttf';
import pixeloidSansBoldUrl from '../../../pixel-assets/fonts/PixeloidSansBold-1jpBg.ttf';
import pixeloidMonoUrl from '../../../pixel-assets/fonts/PixeloidMono-nAOpP.ttf';

// демонстрация bitmap pixeloid текста

export type GameFontFace = 'sans' | 'bold' | 'mono';

/**
 * Рекомендация авторов Pixeloid для bitmap: рантайм-`fontSize` в **целых пикселях** из этого ряда,
 * иначе масштаб глифов относительно атласа (печь {@link BITMAP_FONT_SOURCE_SIZE}) даёт «сжатые» пиксели.
 *
 * По смыслу: **9 × 1, 2, 4, 8, 16** — кратно размеру печи атласа.
 */
export const GAME_BITMAP_TEXT_RECOMMENDED_PX = [9, 18, 36, 72, 144] as const;

/**
 * Семантические размеры UI — только из {@link GAME_BITMAP_TEXT_RECOMMENDED_PX} (или кратно 9).
 */
export const GAME_TEXT_SIZES = {
  caption: 9,
  body: 18,
  sectionTitle: 18,
  display: 36,
} as const;

export type GameTextSizeToken = keyof typeof GAME_TEXT_SIZES;

const FONT_FACE_SPECS: Record<
  GameFontFace,
  { bitmapFontName: string; cssFontFamily: string; sourceUrl: string }
> = {
  sans: {
    bitmapFontName: 'PixeloidSansBitmap',
    cssFontFamily: 'Pixeloid Sans Demo',
    sourceUrl: pixeloidSansUrl,
  },
  bold: {
    bitmapFontName: 'PixeloidSansBoldBitmap',
    cssFontFamily: 'Pixeloid Sans Bold Demo',
    sourceUrl: pixeloidSansBoldUrl,
  },
  mono: {
    bitmapFontName: 'PixeloidMonoBitmap',
    cssFontFamily: 'Pixeloid Mono Demo',
    sourceUrl: pixeloidMonoUrl,
  },
};

export const GAME_FONT_CHARSET_LINES_EN = [
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789',
  `!"#$%&'()*+,-./:;<=>?@[\\]^_\`{|}~`,
] as const;

export const GAME_FONT_CHARSET_LINES_RU = [
  'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ',
  'абвгдеёжзийклмнопрстуфхцчшщъыьэюя',
] as const;

const FONT_CHARSET_LINES = GAME_FONT_CHARSET_LINES_EN;
const FONT_CHARSET_RU_LINES = GAME_FONT_CHARSET_LINES_RU;

const FONT_CHARSET = `${FONT_CHARSET_LINES.join(' ')} ${FONT_CHARSET_RU_LINES.join(' ')} `;

const BITMAP_FONT_RESOLUTION = 1;
const BITMAP_FONT_PADDING = 1;
/** Размер печи глифов в атлас; рантайм-размеры брать кратно этому значению (см. `GAME_BITMAP_TEXT_RECOMMENDED_PX`). */
const BITMAP_FONT_SOURCE_SIZE = 9;
const BITMAP_FONT_SKIP_KERNING = true;
const TEXT_COLOR = 0x2f2419;

const loadedCssFonts = new Set<string>();
const installedBitmapFonts = new Set<string>();

function getFontSpec(face: GameFontFace) {
  return FONT_FACE_SPECS[face];
}

/**
 * Размер в px или токен из {@link GAME_TEXT_SIZES}.
 * Для чётких пикселей предпочтительно значения из {@link GAME_BITMAP_TEXT_RECOMMENDED_PX}.
 */
export type GameTextSize = number | GameTextSizeToken;

/** Выравнивание многострочного блока (как `text-align` в CSS) при `maxWidth`. */
export type GameTextAlign = 'left' | 'center' | 'right' | 'justify';

export type CreateGameBitmapTextOptions = {
  text: string;
  face: GameFontFace;
  size: GameTextSize;
  /** Включает перенос по ширине; длинные слова переносятся построчно (`breakWords`). */
  maxWidth?: number;
  /**
   * Горизонталь выравнивания строк; для многострочного текста с `maxWidth` (по умолчанию `left`).
   */
  align?: GameTextAlign;
  /** Оттенок готового атласа; по умолчанию без сдвига. */
  tint?: number;
};

function resolveSize(size: GameTextSize): number {
  if (typeof size === 'string') {
    return GAME_TEXT_SIZES[size];
  }
  return size;
}

async function ensureFontFaceLoaded(
  spec: (typeof FONT_FACE_SPECS)[GameFontFace],
): Promise<void> {
  if (loadedCssFonts.has(spec.cssFontFamily)) {
    return;
  }

  const fontFace = new FontFace(spec.cssFontFamily, `url(${spec.sourceUrl})`);
  await fontFace.load();
  document.fonts.add(fontFace);
  loadedCssFonts.add(spec.cssFontFamily);
}

/**
 * Предзагрузка всех TTF в `document.fonts`. Вызвать до `BitmapFont.install` (например в `main.ts`).
 */
export async function preloadGameBitmapFonts(): Promise<void> {
  const faces: GameFontFace[] = ['sans', 'bold', 'mono'];
  await Promise.all(faces.map((face) => ensureFontFaceLoaded(getFontSpec(face))));
}

/**
 * Idempotent: регистрирует bitmap-атлас для гарнитуры в Pixi.
 * Нужен предварительно вызванный `preloadGameBitmapFonts` (или отдельная загрузка того же `FontFace`).
 */
export function ensureGameBitmapFontInstalled(face: GameFontFace): void {
  const spec = getFontSpec(face);
  if (installedBitmapFonts.has(spec.bitmapFontName)) {
    return;
  }

  BitmapFont.install({
    name: spec.bitmapFontName,
    style: {
      fontFamily: spec.cssFontFamily,
      fontSize: BITMAP_FONT_SOURCE_SIZE,
      fill: TEXT_COLOR,
    },
    chars: [FONT_CHARSET],
    resolution: BITMAP_FONT_RESOLUTION,
    padding: BITMAP_FONT_PADDING,
    skipKerning: BITMAP_FONT_SKIP_KERNING,
    textureStyle: {
      scaleMode: 'nearest',
    },
  });

  installedBitmapFonts.add(spec.bitmapFontName);
}

/**
 * Создаёт `BitmapText` с Pixeloid, переносом по `maxWidth` и переносом слишком длинных слов.
 * Убедитесь, что вызван `preloadGameBitmapFonts` и `ensureGameBitmapFontInstalled` для `face` (вызов ensure здесь).
 */
export function createGameBitmapText(
  options: CreateGameBitmapTextOptions,
): BitmapText {
  const { text, face, maxWidth, tint, align = 'left' } = options;
  const fontSize = resolveSize(options.size);

  ensureGameBitmapFontInstalled(face);
  const { bitmapFontName } = getFontSpec(face);
  const hasWrap = maxWidth !== undefined;

  const label = new BitmapText({
    text,
    style: {
      fontFamily: bitmapFontName,
      fontSize,
      align,
      wordWrap: hasWrap,
      wordWrapWidth: maxWidth,
      breakWords: hasWrap,
    },
  });

  label.roundPixels = true;
  if (tint !== undefined) {
    label.tint = tint;
  }

  return label;
}

export function getBitmapFontName(face: GameFontFace): string {
  return getFontSpec(face).bitmapFontName;
}

const TEST_ALIGN_MAX_WIDTH = 200;

type TestCommonOptions = {
  text: string;
  maxWidth?: number;
  face?: GameFontFace;
  size?: GameTextSize;
};

/**
 * Тест: однострочный/многострочный bitmap-текст с `align: left` и переносом по `maxWidth`.
 */
export function createTestBitmapTextLeft(
  options: TestCommonOptions,
): BitmapText {
  const { text, maxWidth = TEST_ALIGN_MAX_WIDTH, face = 'sans', size = 'body' } = options;
  return createGameBitmapText({ text, face, size, maxWidth, align: 'left' });
}

/**
 * Тест: вариант с `align: center`.
 */
export function createTestBitmapTextCenter(
  options: TestCommonOptions,
): BitmapText {
  const { text, maxWidth = TEST_ALIGN_MAX_WIDTH, face = 'sans', size = 'body' } = options;
  return createGameBitmapText({ text, face, size, maxWidth, align: 'center' });
}

/**
 * Тест: вариант с `align: right`.
 */
export function createTestBitmapTextRight(
  options: TestCommonOptions,
): BitmapText {
  const { text, maxWidth = TEST_ALIGN_MAX_WIDTH, face = 'sans', size = 'body' } = options;
  return createGameBitmapText({ text, face, size, maxWidth, align: 'right' });
}
