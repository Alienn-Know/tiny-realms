/**
 * 🛠️ Утилита сборки атласа Slime3.
 *
 * Читает `raw_assets/.../Slime3/With_shadow/Slime3_{state}_with_shadow.png`
 * (6 файлов, каждый 4 направления в строках × N кадров в столбцах, frame=64×64),
 * склеивает в один атлас `public/sprites/slime3.png` (640×1536) и генерирует
 * Pixi spritesheet descriptor `public/sprites/slime3.json`.
 *
 * Layout атласа (горизонтальная лента по строкам):
 *   Строка i = state[i] × facing[rowWithinState]
 *   Где rowWithinState: 0=front, 1=right, 2=back, 3=left
 *
 * Запуск: `node tools/build-slime3-atlas.mjs`
 */

import sharp from 'sharp';
import { readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SRC_DIR = join(
  ROOT,
  'raw_assets',
  'craftpix-net-788364-free-slime-mobs-pixel-art-top-down-sprite-pack',
  'PNG',
  'Slime3',
  'With_shadow',
);

const OUT_DIR = join(ROOT, 'public', 'sprites');
const OUT_PNG = join(OUT_DIR, 'slime3.png');
const OUT_JSON = join(OUT_DIR, 'slime3.json');

const FRAME_SIZE = 64;
const FRAMES_PER_ROW = 10; // максимум кадров среди всех состояний (death=10)

/** 📋 Состояния в фиксированном порядке (для детерминированной сборки). */
const STATES = [
  { name: 'idle',   file: 'Slime3_Idle_with_shadow.png' },
  { name: 'walk',   file: 'Slime3_Walk_with_shadow.png' },
  { name: 'run',    file: 'Slime3_Run_with_shadow.png' },
  { name: 'attack', file: 'Slime3_Attack_with_shadow.png' },
  { name: 'hurt',   file: 'Slime3_Hurt_with_shadow.png' },
  { name: 'death',  file: 'Slime3_Death_with_shadow.png' },
];

/** 🧭 Направления в порядке строк внутри каждого state.
 *  Подтверждённый layout Slime3: row 0 = front (вниз), row 1 = back (вверх),
 *  row 2 = left, row 3 = right. */
const FACINGS = ['front', 'back', 'left', 'right'];

/** 🎞️ Длительность одного кадра в секундах для каждого состояния. */
const FRAME_TIME = {
  idle:   0.20,
  walk:   0.12,
  run:    0.08,
  attack: 0.08,
  hurt:   0.10,
  death:  0.12,
};

const LOOP = {
  idle:   true,
  walk:   true,
  run:    true,
  attack: false,
  hurt:   false,
  death:  false,
};

/**
 * 🚀 Главная функция.
 */
async function main() {
  console.log('🛠️  Сборка атласа Slime3 → public/sprites/slime3.{png,json}');

  if (!existsSync(SRC_DIR)) {
    throw new Error(`❌ Исходная папка не найдена: ${SRC_DIR}`);
  }

  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  // 📊 Метаданные каждого state-файла: имя → { width, height, frameCount }
  const sources = [];
  for (const state of STATES) {
    const filePath = join(SRC_DIR, state.file);
    if (!existsSync(filePath)) {
      throw new Error(`❌ Исходный файл не найден: ${filePath}`);
    }
    const meta = await sharp(filePath).metadata();
    if (meta.height !== FRAME_SIZE * FACINGS.length) {
      throw new Error(
        `❌ ${state.file}: ожидаемая высота ${FRAME_SIZE * FACINGS.length}, получено ${meta.height}. ` +
        `Layout: 4 направления в строках × ${FRAME_SIZE}px`,
      );
    }
    const frameCount = Math.floor(meta.width / FRAME_SIZE);
    sources.push({ name: state.name, path: filePath, frameCount, meta });
    console.log(`  ✅ ${state.file}: ${meta.width}×${meta.height} → ${frameCount} кадров`);
  }

  // 🖼️ Создаём пустой canvas-атлас: FRAMES_PER_ROW × 4 × len(STATES) tiles
  const atlasWidth = FRAME_SIZE * FRAMES_PER_ROW;
  const atlasHeight = FRAME_SIZE * FACINGS.length * STATES.length;

  // 🧩 Собираем композит: кадры укладываются построчно (state-major)
  //    composite input = массив { input: {File/Buffer}, top, left }
  const composites = [];
  const frames = {};
  const stateInfo = {};

  for (let sIdx = 0; sIdx < STATES.length; sIdx++) {
    const state = STATES[sIdx];
    const source = sources[sIdx];
    const stateDef = {
      frames: { front: [], back: [], left: [], right: [] },
      frameTime: FRAME_TIME[state.name],
      loop: LOOP[state.name],
    };
    stateInfo[state.name] = stateDef;

    // Извлекаем кадры через sharp.extract
    for (let fIdx = 0; fIdx < FACINGS.length; fIdx++) {
      const facing = FACINGS[fIdx];
      for (let k = 0; k < source.frameCount; k++) {
        const cropLeft = k * FRAME_SIZE;
        const cropTop = fIdx * FRAME_SIZE;
        const rowInAtlas = sIdx * FACINGS.length + fIdx;
        const atlasLeft = k * FRAME_SIZE;
        const atlasTop = rowInAtlas * FRAME_SIZE;

        // Читаем кадр как Buffer
        const frameBuf = await sharp(source.path)
          .extract({ left: cropLeft, top: cropTop, width: FRAME_SIZE, height: FRAME_SIZE })
          .png()
          .toBuffer();

        composites.push({
          input: frameBuf,
          top: atlasTop,
          left: atlasLeft,
        });

        const key = `${state.name}-${facing}-${k}`;
        frames[key] = {
          frame: { x: atlasLeft, y: atlasTop, w: FRAME_SIZE, h: FRAME_SIZE },
          rotated: false,
          trimmed: false,
          sourceSize: { w: FRAME_SIZE, h: FRAME_SIZE },
          spriteSourceSize: { x: 0, y: 0, w: FRAME_SIZE, h: FRAME_SIZE },
        };
      }
    }
  }

  // 🎨 Композим в финальный PNG
  await sharp({
    create: {
      width: atlasWidth,
      height: atlasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(OUT_PNG);

  // 📝 Pixi spritesheet descriptor (v2)
  const descriptor = {
    frames,
    meta: {
      app: 'https://github.com/anomalyco/tiny-realms/tools/build-slime3-atlas.mjs',
      version: '1.0',
      image: 'slime3.png',
      format: 'RGBA8888',
      size: { w: atlasWidth, h: atlasHeight },
      scale: '1',
      frameTags: {},
    },
    // 🗺️ Layout description для game code (необязательно для Pixi, но полезно)
    layout: {
      frameSize: FRAME_SIZE,
      framesPerRow: FRAMES_PER_ROW,
      facings: FACINGS,
      states: STATES.map((s) => s.name),
      frameTime: FRAME_TIME,
      loop: LOOP,
    },
  };

  writeFileSync(OUT_JSON, JSON.stringify(descriptor, null, 2), 'utf-8');

  console.log(`\n✅ Атлас: ${OUT_PNG} (${atlasWidth}×${atlasHeight})`);
  console.log(`✅ Descriptor: ${OUT_JSON}`);
  console.log(`\n📊 State/Facing раскладка:`);
  for (let s = 0; s < STATES.length; s++) {
    for (let f = 0; f < FACINGS.length; f++) {
      console.log(`   row ${s * 4 + f}: ${STATES[s].name}-${FACINGS[f]}`);
    }
  }
}

main().catch((err) => {
  console.error('💥 build-slime3-atlas упал:', err);
  process.exit(1);
});
