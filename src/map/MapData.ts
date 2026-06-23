import type { Texture } from 'pixi.js';
import type { TiledCompression, TiledEncoding, TiledObject, TiledRenderOrder } from './TiledTypes';

/**
 * 🗺️ Нормализованная runtime-структура карты (после парсинга Tiled JSON).
 *
 * В отличие от сырого Tiled JSON, тут:
 * - Тайлсеты уже загружены как Pixi `Texture`;
 * - Tile layers хранят данные как `Int32Array` (быстрее, плотнее);
 * - Флаги трансформации (hFlip/vFlip/diagRot) отделены в `Uint8Array`;
 * - Объекты собраны в плоский список из всех objectgroup слоёв (рекурсивно через group);
 * - `walkableByLocalId` предрассчитан для collision queries;
 * - Image layers предзагружены как `Texture`;
 * - Group layers сохраняют структуру (для рендера по z-порядку).
 */

/** 🧱 Кадр анимации тайла (runtime-friendly). */
export type TileAnimationFrame = {
  /** 🆔 ID кадра внутри тайлсета. */
  localId: number;
  /** ⏱️ Длительность в мс. */
  durationMs: number;
};

/** 🪃 Анимация тайла. */
export type TileAnimation = {
  frames: TileAnimationFrame[];
  loop: boolean;
};

/** 🗂️ Тайлсет с загруженной текстурой. */
export type TilesetData = {
  name?: string;
  firstgid: number;
  texture: Texture;
  tileWidth: number;
  tileHeight: number;
  /** 🧮 Колонок в атласе. */
  columns: number;
  /** 📦 Всего тайлов. */
  tileCount: number;
  /** ↔️ Buffer между краем картинки и первым тайлом (px). */
  margin: number;
  /** ↔️ Spacing между тайлами (px). */
  spacing: number;
  /** ↔️ Tile offset (опционально). */
  tileOffset?: { x: number; y: number };
  /** 🚧 `localId → walkable` (default true если property не задана). */
  walkableByLocalId: Map<number, boolean>;
  /** 🪃 `localId → animation` (только для анимированных тайлов). */
  animationsByLocalId: Map<number, TileAnimation>;
  /** 🚧 `localId → collision shapes` (из `tile.objectgroup`). */
  tileCollisionShapes: Map<number, TiledObject[]>;
};

/** 🗺️ Tile layer (runtime: данные + флаги + метаданные рендера). */
export type TileLayerData = {
  name: string;
  /** 🆔 `gid` per tile (0 = empty). Построчно. */
  data: Int32Array;
  /** 🔄 Per-tile флаги трансформации: 4 бита [hFlip, vFlip, diagRot]. */
  flipFlags: Uint8Array;
  /** ↔️ Ширина массива `data` в тайлах (per-layer, для infinite может отличаться от map.width). */
  width: number;
  /** ↕️ Высота массива `data` в тайлах. */
  height: number;
  /** ↔️ Смещение слоя в тайлах относительно (0,0) мира (для infinite maps с neg coords). */
  chunkOffsetX: number;
  /** ↕️ Смещение слоя в тайлах. */
  chunkOffsetY: number;
  /** 🔤 Encoding исходника (для diagnostics). */
  encoding: TiledEncoding;
  /** 🗜️ Compression исходника. */
  compression: TiledCompression;
  /** ↔️ Layer offset (px). */
  offsetX: number;
  offsety: number;
  /** 🌫️ Opacity (0..1, default 1). */
  opacity: number;
  /** 📷 Parallax factor (default 1). */
  parallaxX: number;
  parallaxY: number;
  /** 🎨 Tint color (#RRGGBB or #AARRGGBB, optional). */
  tintColor?: string;
  /** 👁️ Visible (default true). */
  visible: boolean;
};

/** 🖼️ Image layer (runtime: предзагруженная текстура + метаданные). */
export type ImageLayerData = {
  name: string;
  texture: Texture;
  imagewidth: number;
  imageheight: number;
  offsetX: number;
  offsety: number;
  opacity: number;
  parallaxX: number;
  parallaxY: number;
  tintColor?: string;
  visible: boolean;
  /** 🔁 Repeat (TilingSprite вместо Sprite). */
  repeatX: boolean;
  repeatY: boolean;
};

/** 📁 Group layer (runtime: вложенные слои для z-порядка). */
export type GroupLayerData = {
  name: string;
  offsetX: number;
  offsety: number;
  opacity: number;
  parallaxX: number;
  parallaxY: number;
  tintColor?: string;
  visible: boolean;
  /** 📚 Вложенные слои (любого типа). */
  layers: NestedLayer[];
};

/** 📚 Любой вложенный слой внутри group. */
export type NestedLayer = TileLayerData | ImageLayerData | GroupLayerData;

/** 🗺️ Полная runtime-структура карты. */
export type MapData = {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  /** 🧭 Orientation. */
  orientation: string;
  /** 🎨 Render order (orthogonal). */
  renderorder: TiledRenderOrder;
  /** 🌫️ Background color (#RRGGBB or #AARRGGBB, optional). */
  backgroundcolor?: string;
  /** ♾️ Infinite map (для информации; chunks уже слиты в плоский массив). */
  infinite: boolean;
  /** ↔️ Глобальное смещение карты в пикселях (для infinite maps с отрицательными chunk coords). */
  offsetX: number;
  /** ↕️ Глобальное смещение карты в пикселях. */
  offsetY: number;
  /** 📷 Parallax origin (since 1.8). */
  parallaxOriginX: number;
  parallaxOriginY: number;
  /** 🗺️ Tile layers (z-порядок = порядок в массиве). */
  tileLayers: TileLayerData[];
  /** 🖼️ Image layers. */
  imageLayers: ImageLayerData[];
  /** 📁 Group layers (с вложенными слоями). */
  groupLayers: GroupLayerData[];
  /** 👥 Плоский список объектов из всех objectgroup слоёв (рекурсивно). */
  objects: TiledObject[];
  /** 🗂️ Тайлсеты. */
  tilesets: TilesetData[];
};
