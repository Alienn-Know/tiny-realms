/**
 * 🗺️ Типы Tiled JSON 1.12 — 1:1 зеркало спецификации.
 *
 * Ссылка: https://doc.mapeditor.org/en/stable/reference/json-map-format/
 *
 * Конвенция:
 * - Поля, помеченные `?`, опциональны в формате Tiled.
 * - Имена полей сохранены как в спеке (snake_case), не как в коде.
 * - Для Object/Tile используется `type` (Tiled 1.10 вернул из `class`).
 * - Для Map/Tileset/Layer/WangSet используется `class?` (Tiled 1.9).
 * - Editor-only поля (wangsets, terrains, editorsettings) опущены —
 *   loader их игнорирует с warn'ом.
 */

// ── Property ──────────────────────────────────────────────────────────

/** 🏷️ Custom property Tiled (у тайла, объекта, слоя, карты, тайлсета). */
export type TiledPropertyType =
  | 'string'
  | 'int'
  | 'float'
  | 'bool'
  | 'color'
  | 'file'
  | 'object'
  | 'class';

/** 🏷️ Custom property Tiled. */
export type TiledProperty = {
  name: string;
  type: TiledPropertyType;
  /** 🏷️ Имя custom property type (since 1.8, только если `type === 'class'`). */
  propertytype?: string;
  value: unknown;
};

// ── Point (polygon/polyline vertex) ───────────────────────────────────

/** 📍 Точка полигона/полилинии (относительно позиции объекта). */
export type TiledPoint = {
  x: number;
  y: number;
};

// ── Text object ───────────────────────────────────────────────────────

/** 📝 Параметры текстового объекта Tiled. */
export type TiledText = {
  text: string;
  fontfamily?: string;
  pixelsize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeout?: boolean;
  halign?: 'center' | 'right' | 'justify' | 'left';
  valign?: 'center' | 'bottom' | 'top';
  kerning?: boolean;
  wrap?: boolean;
};

// ── Frame (tile animation) ────────────────────────────────────────────

/** 🖼️ Кадр анимации тайла. */
export type TiledFrame = {
  /** ⏱️ Длительность кадра в миллисекундах. */
  duration: number;
  /** 🆔 Local tile ID (0-based внутри тайлсета). */
  tileid: number;
};

// ── Tile definition ───────────────────────────────────────────────────

/** 🧱 Определение тайла внутри тайлсета (с properties, animation, collision). */
export type TiledTilesetTile = {
  /** 🆔 Local ID тайла (0-based). */
  id: number;
  /** 🎬 Анимация тайла (опционально). */
  animation?: TiledFrame[];
  /** 🏷️ Custom properties. */
  properties?: TiledProperty[];
  /** 🖼️ Картинка тайла (для image collection tilesets). */
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  /** 📐 Sub-rectangle в атласе (since 1.9, по умолчанию весь image). */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** 🚧 Objectgroup — collision shapes тайла (опционально). */
  objectgroup?: TiledObjectGroup;
  /** 🎲 Вероятность выбора в редакторе (default: 1). */
  probability?: number;
  /** 🏷️ Class тайла (Tiled 1.10 — обратно `type`). */
  type?: string;
};

// ── Tileset sub-types ─────────────────────────────────────────────────

/** 🔲 Grid тайлсета (опционально). */
export type TiledGrid = {
  orientation?: 'orthogonal' | 'isometric';
  width: number;
  height: number;
};

/** ↔️ Offset тайлов в тайлсете (опционально). */
export type TiledTileOffset = {
  x: number;
  /** ↕️ Positive is down. */
  y: number;
};

/** 🔄 Allowed transformations (since 1.5, опционально). */
export type TiledTransformations = {
  hflip?: boolean;
  vflip?: boolean;
  rotate?: boolean;
  preferuntransformed?: boolean;
};

/** 🗂️ Тайлсет (атлас тайлов). */
export type TiledTileset = {
  /** 🆔 GID первого тайла (для multi-tileset карт). */
  firstgid: number;
  name?: string;
  /** 📂 Путь к внешнему файлу тайлсета (.tsx/.json). Если задан — остальные поля грузятся из него. */
  source?: string;
  /** 🖼️ PNG-атлас (inline tileset). */
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  /** 📏 Размер тайла. */
  tilewidth: number;
  tileheight: number;
  /** 🧮 Колонок в атласе. */
  columns?: number;
  /** 📦 Всего тайлов. */
  tilecount?: number;
  /** ↔️ Buffer между краем картинки и первым тайлом (px). */
  margin?: number;
  /** ↔️ Spacing между тайлами (px). */
  spacing?: number;
  /** ↔️ Tile offset (опционально). */
  tileoffset?: TiledTileOffset;
  /** 🔲 Grid (опционально). */
  grid?: TiledGrid;
  /** 🧱 Per-tile данные (properties, animation, collision). */
  tiles?: TiledTilesetTile[];
  /** 🏷️ Custom properties тайлсета. */
  properties?: TiledProperty[];
  /** 🏷️ Class (since 1.9). */
  class?: string;
  /** 🔄 Allowed transformations (since 1.5). */
  transformations?: TiledTransformations;
  /** 🎨 Alignment для tile objects (since 1.4). */
  objectalignment?: string;
  /** 🖼️ Fill mode (since 1.9). */
  fillmode?: 'stretch' | 'preserve-aspect-fit';
  /** 📏 Tile render size (since 1.9). */
  tilerendersize?: 'tile' | 'grid';
  transparentcolor?: string;
  backgroundcolor?: string;
  tiledversion?: string;
  type?: string;
  version?: string | number;
};

// ── Chunk (infinite maps) ─────────────────────────────────────────────

/** 🧩 Chunk для infinite maps. */
export type TiledChunk = {
  /** 🆔 GIDs (array или base64-encoded string). */
  data: number[] | string;
  width: number;
  height: number;
  /** 📍 X в тайлах (может быть отрицательным). */
  x: number;
  y: number;
};

// ── Layers ────────────────────────────────────────────────────────────

/** 🎨 Blend mode для слоя (since 1.12). */
export type TiledBlendMode =
  | 'normal'
  | 'add'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

/** 🌐 Render order (orthogonal maps). */
export type TiledRenderOrder = 'right-down' | 'right-up' | 'left-down' | 'left-up';

/** 🔤 Encoding tile layer data. */
export type TiledEncoding = 'csv' | 'base64';

/** 🗜️ Compression для base64 tile layer data. */
export type TiledCompression = '' | 'zlib' | 'gzip' | 'zstd';

/** 🗺️ Тайловый слой. */
export type TiledTileLayer = {
  type: 'tilelayer';
  id?: number;
  name: string;
  class?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 🆔 GIDs (array для CSV, base64-string для base64). */
  data: number[] | string;
  encoding?: TiledEncoding;
  compression?: TiledCompression;
  /** 🧩 Chunks (для infinite maps). */
  chunks?: TiledChunk[];
  startx?: number;
  starty?: number;
  /** ↔️ Layer offset (px, default 0). */
  offsetx?: number;
  offsety?: number;
  opacity?: number;
  parallaxx?: number;
  parallaxy?: number;
  tintcolor?: string;
  visible?: boolean;
  locked?: boolean;
  mode?: TiledBlendMode;
  properties?: TiledProperty[];
};

/** 🖼️ Image layer — одна картинка как фон/параллакс. */
export type TiledImageLayer = {
  type: 'imagelayer';
  id?: number;
  name: string;
  class?: string;
  image: string;
  imagewidth?: number;
  imageheight?: number;
  /** 🔁 Repeat (since 1.8). */
  repeatx?: boolean;
  repeaty?: boolean;
  transparentcolor?: string;
  offsetx?: number;
  offsety?: number;
  opacity?: number;
  parallaxx?: number;
  parallaxy?: number;
  tintcolor?: string;
  visible?: boolean;
  locked?: boolean;
  mode?: TiledBlendMode;
  properties?: TiledProperty[];
};

/** 👤 Объект на objectgroup слое. */
export type TiledObject = {
  id: number;
  /** 🏷️ Name (опционально). */
  name?: string;
  /** 🏷️ Class/type (Tiled 1.10 — `type`). */
  type?: string;
  /** 📍 Top-left X в пикселях мира. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** 🔄 Поворот в градусах (clockwise). */
  rotation?: number;
  /** 🌫️ Opacity (since 1.12, default 1). */
  opacity?: number;
  visible?: boolean;
  /** 🆔 GID — если объект представляет тайл. */
  gid?: number;
  /** 📌 Point shape. */
  point?: boolean;
  /** ⭕ Ellipse shape. */
  ellipse?: boolean;
  /** 💊 Capsule shape (since 1.12). */
  capsule?: boolean;
  /** 📐 Polygon. */
  polygon?: TiledPoint[];
  /** 〰️ Polyline. */
  polyline?: TiledPoint[];
  /** 📝 Text object. */
  text?: TiledText;
  /** 📋 Template reference (path к .tx/.txj файлу). */
  template?: string;
  properties?: TiledProperty[];
};

/** 👥 Objectgroup слой. */
export type TiledObjectGroup = {
  type: 'objectgroup';
  id?: number;
  name: string;
  class?: string;
  objects: TiledObject[];
  draworder?: 'topdown' | 'index';
  offsetx?: number;
  offsety?: number;
  opacity?: number;
  parallaxx?: number;
  parallaxy?: number;
  tintcolor?: string;
  visible?: boolean;
  locked?: boolean;
  mode?: TiledBlendMode;
  properties?: TiledProperty[];
};

/** 📁 Group layer — контейнер других слоёв. */
export type TiledGroupLayer = {
  type: 'group';
  id?: number;
  name: string;
  class?: string;
  layers: TiledLayer[];
  offsetx?: number;
  offsety?: number;
  opacity?: number;
  parallaxx?: number;
  parallaxy?: number;
  tintcolor?: string;
  visible?: boolean;
  locked?: boolean;
  mode?: TiledBlendMode;
  properties?: TiledProperty[];
};

/** 📚 Любой слой карты. */
export type TiledLayer = TiledTileLayer | TiledObjectGroup | TiledImageLayer | TiledGroupLayer;

// ── Map ───────────────────────────────────────────────────────────────

/** 🧭 Orientation карты. */
export type TiledOrientation = 'orthogonal' | 'isometric' | 'staggered' | 'hexagonal';

/** 🗺️ Корневой JSON карты Tiled. */
export type TiledMap = {
  type?: 'map';
  version?: string | number;
  tiledversion?: string;
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  orientation: TiledOrientation;
  /** 🎨 Render order (orthogonal, default 'right-down'). */
  renderorder?: TiledRenderOrder;
  /** 🌫️ Background color (#RRGGBB or #AARRGGBB). */
  backgroundcolor?: string;
  /** 🏷️ Class (since 1.9). */
  class?: string;
  /** 🗜️ Compression level для tile layer data (default -1). */
  compressionlevel?: number;
  /** ♾️ Infinite map (default false). */
  infinite?: boolean;
  /** 🔢 Next layer id (auto-increment). */
  nextlayerid?: number;
  /** 🔢 Next object id (auto-increment). */
  nextobjectid?: number;
  /** 📷 Parallax origin (since 1.8, default 0). */
  parallaxoriginx?: number;
  parallaxoriginy?: number;
  /** 🔷 Hex side length (hexagonal only). */
  hexsidelength?: number;
  /** 📐 Skew (oblique only). */
  skewx?: number;
  skewy?: number;
  /** 📐 Stagger axis (staggered/hexagonal). */
  staggeraxis?: 'x' | 'y';
  /** 📐 Stagger index (staggered/hexagonal). */
  staggerindex?: 'odd' | 'even';
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  properties?: TiledProperty[];
};

// ── Object template ───────────────────────────────────────────────────

/** 📋 Object template (.txj файл) — дефолты для объекта-инстанса. */
export type TiledObjectTemplate = {
  type: 'template';
  tileset?: TiledTileset;
  object: TiledObject;
};
