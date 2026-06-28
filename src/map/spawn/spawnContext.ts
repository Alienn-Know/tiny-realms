import type { Container } from 'pixi.js';
import type { ResolvedMap, TileSetRenderer } from 'pixi-tiledmap';
import type { World } from '../../core/ecs';
import type { CollisionGrid } from '../CollisionGrid';
import type { TilemapConfig } from '../../core/assets/AssetsConfig';

/**
 * 🎮 Контекст для ObjectSpawner — всё, что handler'у нужно для спавна.
 */
export type SpawnContext = {
  world: World;
  worldContainer: Container;
  resolvedMap: ResolvedMap;
  tileSetRenderers: TileSetRenderer[];
  collision: CollisionGrid;
  tilemapConfig: TilemapConfig;
  /** 🖼️ alias → Texture | Spritesheet (из AssetsManager — для non-tile объектов). */
  textures: Record<string, unknown>;
};
