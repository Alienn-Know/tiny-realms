import { Container } from 'pixi.js';
import {
  createGameBitmapText,
  GAME_FONT_CHARSET_LINES_EN,
  GAME_FONT_CHARSET_LINES_RU,
  GAME_TEXT_SIZES,
  type GameFontFace,
} from './gameBitmapText';

type FontShowcaseOptions = {
  world: Container;
  x: number;
  y: number;
};

type FontSpec = {
  face: GameFontFace;
  title: string;
  sampleTextA: string;
  sampleTextB: string;
  sampleTextRuA: string;
  sampleTextRuB: string;
};

const FONT_SPECS: FontSpec[] = [
  {
    face: 'sans',
    title: 'Pixeloid Sans',
    sampleTextA: 'Bright pixels line up cleanly. Every item label stays easy to scan.',
    sampleTextB: 'This font feels neutral and readable. It works well for general UI copy.',
    sampleTextRuA:
      'Яркие пиксели выстраиваются ровно. Подписи предметов остаются легкими для чтения.',
    sampleTextRuB:
      'Этот шрифт выглядит спокойно и понятно. Он хорошо подходит для обычного текста интерфейса.',
  },
  {
    face: 'bold',
    title: 'Pixeloid Sans Bold',
    sampleTextA: 'Bold glyphs push the eye forward. Short notes become much stronger.',
    sampleTextB: 'Use this weight for emphasis and headings. It keeps a loud retro feel.',
    sampleTextRuA:
      'Жирные символы сразу тянут взгляд вперед. Короткие заметки становятся заметно сильнее.',
    sampleTextRuB:
      'Используй этот вес для акцентов и заголовков. Он сохраняет громкое ретро-настроение.',
  },
  {
    face: 'mono',
    title: 'Pixeloid Mono',
    sampleTextA: 'Mono spacing helps code-like text. Columns stay aligned across rows.',
    sampleTextB: 'This one suits debug panels and stats. Numbers read evenly at a glance.',
    sampleTextRuA:
      'Моноширинный шаг помогает тексту в стиле кода. Столбцы остаются ровными по строкам.',
    sampleTextRuB:
      'Этот вариант подходит для отладки и статистики. Числа читаются ровно с первого взгляда.',
  },
];

const SECTION_SPACING_Y = 212;
const SECTION_TEXT_MAX_WIDTH = 392;
const LANGUAGE_COLUMN_GAP = 452;

function buildLanguageColumn(
  spec: FontSpec,
  headingText: string,
  charsetText: string,
  sampleTextA: string,
  sampleTextB: string,
): Container {
  const column = new Container();
  const heading = createGameBitmapText({
    text: headingText,
    face: spec.face,
    size: GAME_TEXT_SIZES.sectionTitle,
  });
  const charset = createGameBitmapText({
    text: charsetText,
    face: spec.face,
    size: GAME_TEXT_SIZES.caption,
  });
  const sampleA = createGameBitmapText({
    text: sampleTextA,
    face: spec.face,
    size: GAME_TEXT_SIZES.body,
    maxWidth: SECTION_TEXT_MAX_WIDTH,
  });
  const sampleB = createGameBitmapText({
    text: sampleTextB,
    face: spec.face,
    size: GAME_TEXT_SIZES.body,
    maxWidth: SECTION_TEXT_MAX_WIDTH,
  });

  heading.position.set(0, 0);
  charset.position.set(0, 28);
  sampleA.position.set(0, 98);
  sampleB.position.set(0, 154);

  column.addChild(heading);
  column.addChild(charset);
  column.addChild(sampleA);
  column.addChild(sampleB);

  return column;
}

function buildFontSection(spec: FontSpec, y: number): Container {
  const section = new Container();
  const title = createGameBitmapText({
    text: spec.title,
    face: spec.face,
    size: GAME_TEXT_SIZES.display,
  });
  const englishColumn = buildLanguageColumn(
    spec,
    'English',
    GAME_FONT_CHARSET_LINES_EN.join('\n'),
    spec.sampleTextA,
    spec.sampleTextB,
  );
  const russianColumn = buildLanguageColumn(
    spec,
    'Русский',
    GAME_FONT_CHARSET_LINES_RU.join('\n'),
    spec.sampleTextRuA,
    spec.sampleTextRuB,
  );

  section.position.set(0, y);

  title.position.set(0, 0);
  englishColumn.position.set(0, 28);
  russianColumn.position.set(LANGUAGE_COLUMN_GAP, 28);

  section.addChild(title);
  section.addChild(englishColumn);
  section.addChild(russianColumn);

  return section;
}

export function createFontShowcase(options: FontShowcaseOptions): Container {
  const root = new Container();

  root.position.set(options.x, options.y);
  options.world.addChild(root);

  for (let index = 0; index < FONT_SPECS.length; index += 1) {
    const spec = FONT_SPECS[index];
    root.addChild(buildFontSection(spec, index * SECTION_SPACING_Y));
  }

  return root;
}
