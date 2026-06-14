import { Container } from 'pixi.js';
import {
  createGameBitmapText,
  GAME_TEXT_SIZES,
  createTestBitmapTextCenter,
  createTestBitmapTextLeft,
  createTestBitmapTextRight,
} from './gameBitmapText';

// демонстрация стилицации текста (лево, центр, право)

const DEMO_SAMPLE =
  'The quick brown fox. Русский перенос. ' +
  'Supercalifragilisticexpialidocious — long word.';

const ROW_GAP = 6;
const GROUP_GAP = 20;
const FOOT_GAP = 20;

/**
 * Узкая колонка: кегль `caption` (9 px) и половина ширины от тестового столбца — чёткие пиксели по гайду шрифта.
 */
const DENSE_BODY = GAME_TEXT_SIZES.caption;
const DENSE_MAX_WIDTH = 200 / 2;

const ENGLISH_DENSE = [
  'The quick brown fox jumps over the lazy dog. ',
  'This block uses the same API as the rows above, ',
  'but with half the run font size and half the wrap width, ',
  'so one line of pixels fits about half the characters of the default body column.',
].join('');

/** Слева на «карте», под зоной блокнота, левее витрины шрифтов (x≈560+). */
const DEFAULT_WORLD_X = 24;
const DEFAULT_WORLD_Y = 300;

export type TextAlignWorldDemoOptions = {
  world: Container;
  /** Мировые координаты левого верхнего угла блока. */
  x?: number;
  y?: number;
};

/**
 * Панель: три блока с `align: left | center | right` и автопереносом (`maxWidth`).
 * Рисуется в **world** — двигается и масштабируется вместе с камерой.
 */
export function createTextAlignmentWorldDemo(
  options: TextAlignWorldDemoOptions,
): void {
  const { world, x = DEFAULT_WORLD_X, y = DEFAULT_WORLD_Y } = options;
  const root = new Container();
  root.label = 'textAlignDemo';

  const leftLabel = createGameBitmapText({
    text: 'left',
    face: 'mono',
    size: 'caption',
  });
  const leftBlock = createTestBitmapTextLeft({ text: DEMO_SAMPLE });

  const centerLabel = createGameBitmapText({
    text: 'center',
    face: 'mono',
    size: 'caption',
  });
  const centerBlock = createTestBitmapTextCenter({ text: DEMO_SAMPLE });

  const rightLabel = createGameBitmapText({
    text: 'right',
    face: 'mono',
    size: 'caption',
  });
  const rightBlock = createTestBitmapTextRight({ text: DEMO_SAMPLE });

  let contentY = 0;
  for (const step of [
    { label: leftLabel, block: leftBlock },
    { label: centerLabel, block: centerBlock },
    { label: rightLabel, block: rightBlock },
  ]) {
    step.label.position.set(0, contentY);
    contentY += step.label.height + ROW_GAP;
    step.block.position.set(0, contentY);
    contentY += step.block.height + GROUP_GAP;
  }

  contentY += FOOT_GAP;
  const denseLabel = createGameBitmapText({
    text: 'en · half line / half size',
    face: 'mono',
    size: 'caption',
  });
  const denseEn = createGameBitmapText({
    text: ENGLISH_DENSE,
    face: 'sans',
    size: DENSE_BODY,
    maxWidth: DENSE_MAX_WIDTH,
    align: 'left',
  });
  denseLabel.position.set(0, contentY);
  contentY += denseLabel.height + ROW_GAP;
  denseEn.position.set(0, contentY);

  root.addChild(
    leftLabel,
    leftBlock,
    centerLabel,
    centerBlock,
    rightLabel,
    rightBlock,
    denseLabel,
    denseEn,
  );
  root.position.set(x, y);
  world.addChild(root);
}
