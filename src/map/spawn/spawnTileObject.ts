import { Sprite } from 'pixi.js';
import { SizeComponent } from '../../components/SizeComponent';
import { SpriteComponent } from '../../components/SpriteComponent';
import type { ResolvedObject, ResolvedTile } from 'pixi-tiledmap';
import type { Entity } from '../../core/ecs';
import type { SpawnContext } from './spawnContext';
import { finalizeSpawn } from './spawnUtils';

/**
 * 🖼️ Спавн Tile object: `obj.tile` → текстура из resolved tileset → Sprite.
 * Применяет flip-флаги из gid.
 */
export function spawnTileObject(
  ctx: SpawnContext,
  id: Entity,
  obj: ResolvedObject,
  w: number,
  h: number,
  onPlayer?: (id: Entity) => void,
): Entity {
  if (!obj.tile) return -1 as unknown as Entity;

  const sprite = createTileSprite(ctx, obj.tile);
  if (!sprite) return -1 as unknown as Entity;

  ctx.world.addComponent(id, new SpriteComponent(sprite));
  if (w > 0 && h > 0) {
    ctx.world.addComponent(id, new SizeComponent(w, h, true));
  }
  const alias = ctx.tilemapConfig.objectTypes[obj.type ?? ''];
  finalizeSpawn(ctx, id, obj, alias, onPlayer);
  return id;
}

/**
 * 🔄 Создать Sprite для tile-объекта с flip-флагами.
 */
function createTileSprite(ctx: SpawnContext, tile: ResolvedTile): Sprite | null {
  const tsRenderer = ctx.tileSetRenderers[tile.tilesetIndex];
  if (!tsRenderer) return null;
  const tex = tsRenderer.getTexture(tile.localId);
  if (!tex) return null;
  const sprite = new Sprite(tex);
  if (tile.horizontalFlip) sprite.scale.x = -1;
  if (tile.verticalFlip) sprite.scale.y = -1;
  if (tile.diagonalFlip) sprite.rotation = -Math.PI / 2;
  return sprite;
}
