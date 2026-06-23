/**
 * 📦 Конфиг ассетов и таймапов — загружается из `public/load-config.json` в runtime.
 *
 * Полностью data-driven: все пути, размеры тайлов, маппинги object types →
 * bundle aliases живут в JSON, не в TypeScript. Хочешь переименовать ассет
 * или сменить тип объекта — правишь `load-config.json`, не код.
 *
 * Пример структуры `load-config.json`:
 * ```json
 * {
 *   "bundles": {
 *     "terrain": { "type": "tileset", "path": "tilesets/terrain.png", "tileSize": 16, "walkableProperty": "walkable" },
 *     "player":  { "type": "sprite", "path": "sprites/player.png" },
 *     "enemy":   { "type": "sprite", "path": "sprites/enemy.png" }
 *   },
 *   "tilemaps": [
 *     {
 *       "name": "level1",
 *       "path": "maps/level1.json",
 *       "tileLayer": "ground",
 *       "objectLayers": ["entities"],
 *       "objectTypes": { "player_spawn": "player", "enemy": "enemy", "npc": "npc" },
 *       "objectSizeFallback": "tile"
 *     }
 *   ]
 * }
 * ```
 */

export type TilesetBundleConfig = {
  type: 'tileset';
  /** 📂 Путь относительно `public/` (Vite раздаёт с корня). */
  path: string;
  /** 📏 Размер тайла в пикселях (должен совпадать с Tiled tileset). */
  tileSize: number;
  /** 🏷️ Имя property в Tiled tiles (опционально). Если нет — все тайлы проходимы. */
  walkableProperty?: string;
};

export type SpriteBundleConfig = {
  type: 'sprite';
  /** 📂 Путь относительно `public/`. */
  path: string;
};

export type SpritesheetBundleConfig = {
  type: 'spritesheet';
  /** 🖼️ PNG-атлас. */
  image: string;
  /** 📋 JSON-описание кадров (Pixi spritesheet format). */
  data: string;
};

export type BundleConfig = TilesetBundleConfig | SpriteBundleConfig | SpritesheetBundleConfig;

export type ObjectSizeFallback = 'tile' | 'zero' | 'object';

export type TilemapFormat = 'json';

export type TilemapConfig = {
  /** 🏷️ Имя карты (для логов, мульти-карта). */
  name: string;
  /** 📂 Путь к Tiled JSON относительно `public/`. */
  path: string;
  /** 🗂️ Формат карты (пока только `'json'`; `'tmx'` может быть добавлен позже). */
  format?: TilemapFormat;
  /** 🗺️ Имена tile-слоёв в Tiled (с `type: "tilelayer"`). Z-порядок = порядок в массиве. */
  tileLayers: string[];
  /** 👥 Имена objectgroup слоёв для спавна entity. */
  objectLayers: string[];
  /** 🔀 Маппинг `TiledObject.type → bundle alias` (например, `"player_spawn" → "player"`). */
  objectTypes: Record<string, string>;
  /** 📐 Что делать если у объекта `width=0/height=0`:
   *  - `'tile'` — взять tile size из тайлсета (по умолчанию для Tiled объектов-маркеров);
   *  - `'zero'` — оставить 0×0 (для маркеров без коллизии);
   *  - `'object'` — игнорировать fallback (нужен явный размер). */
  objectSizeFallback: ObjectSizeFallback;
};

export type LoadConfig = {
  /** 🗂️ Бандлы ассетов. Ключ = alias (используется в `objectTypes` и спавнерах). */
  bundles: Record<string, BundleConfig>;
  /** 🗺️ Список таймапов. */
  tilemaps: TilemapConfig[];
};
