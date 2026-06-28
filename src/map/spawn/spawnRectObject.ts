import { Sprite } from 'pixi.js';
import { SizeComponent } from '../../components/SizeComponent';
import { SpriteComponent } from '../../components/SpriteComponent';
import type { ResolvedObject } from 'pixi-tiledmap';
import type { Entity } from '../../core/ecs';
import type { SpawnContext } from './spawnContext';
import { finalizeSpawn } from './spawnUtils';

/**
 * 🟦 Спавн Rectangle object: alias → Texture → Sprite.
 *
 * Rectangle объекты — это AABB-объекты в Tiled, у которых нет `obj.tile`,
 * но есть `obj.type` (или `obj.name`), которые мапятся в `objectTypes`
 * → alias → Texture в `AssetsManager`.
 *
 * @param onPlayer - callback для player-spawn объектов (вызывается в finalizeSpawn
 *                   ПОСЛЕ создания SpriteComponent — нужно для подмены view на AnimatedSprite).
 */
export function spawnRectObject(
  ctx: SpawnContext,
  id: Entity,
  obj: ResolvedObject,
  w: number,
  h: number,
  alias: string | undefined,
  onPlayer?: (id: Entity) => void,
): Entity {
  if (alias) {
    const tex = ctx.textures[alias];
    if (tex) {
      const sprite = new Sprite(tex as never);
      ctx.world.addComponent(id, new SpriteComponent(sprite));
      if (w > 0 && h > 0) {
        ctx.world.addComponent(id, new SizeComponent(w, h, true));
      }
    } else {
      console.warn(`[ObjectSpawner] No texture loaded for alias "${alias}"`);
    }
  } else if (obj.type) {
    console.warn(`[ObjectSpawner] No alias mapping for type "${obj.type}"`);
  }
  finalizeSpawn(ctx, id, obj, alias, onPlayer);
  return id;
}
