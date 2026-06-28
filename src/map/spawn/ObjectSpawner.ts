import type { Entity } from '../../core/ecs';
import type { ResolvedObject, ResolvedObjectLayer } from 'pixi-tiledmap';
import { setupPlayerAnimation } from './playerAnimation';
import { spawnRectObject } from './spawnRectObject';
import { spawnShapeObject } from './spawnShapeObject';
import { spawnTextObject } from './spawnTextObject';
import { spawnTileObject } from './spawnTileObject';
import {
  attachShapeIfPresent,
  createBaseEntity,
  extractShape,
  resolveSize,
  resolveTransform,
} from './spawnUtils';
import type { SpawnContext } from './spawnContext';

export type { SpawnContext } from './spawnContext';

/**
 * 👤 ObjectSpawner — generic спавнер сущностей из Tiled object layer.
 *
 * Поддерживает:
 * - Rectangle objects (через `objectTypes` mapping)
 * - Tile objects (`obj.tile` — текстура из resolved tileset, вырезанная по `localId`)
 * - Shape objects (point/ellipse/polygon/polyline/capsule → `ShapeComponent`)
 * - Text objects (Pixi `Text` вместо `Sprite`)
 *
 * Каждый тип объекта обрабатывается отдельным модулем в `spawn/`.
 * Этот класс — только оркестрация: обход слоёв + dispatch по типу.
 *
 * Object templates уже материализованы в `ResolvedObject` самой pixi-tiledmap.
 */
export class ObjectSpawner {
  /**
   * 🎬 Спавнит все объекты из указанных object-слоёв.
   * Возвращает id player (или null).
   */
  static spawnAll(ctx: SpawnContext): Entity | null {
    let playerId: Entity | null = null;
    const allowed = ctx.tilemapConfig.objectLayers;

    for (const layer of ctx.resolvedMap.layers) {
      if (layer.type !== 'objectgroup') continue;
      if (allowed.length > 0 && !allowed.includes(layer.name)) continue;

      for (const obj of layer.objects) {
        const id = ObjectSpawner.#spawnOne(ctx, layer, obj);
        if (id < 0) continue;
        const alias = ctx.tilemapConfig.objectTypes[obj.type ?? ''];
        if (obj.type === 'player_spawn' || alias === 'player') {
          if (playerId !== null) {
            console.warn('[ObjectSpawner] Multiple player_spawn, using first');
          } else {
            playerId = id;
          }
        }
      }
    }

    return playerId;
  }

  /**
   * 🛠️ Спавн одного объекта: dispatch по типу.
   */
  static #spawnOne(
    ctx: SpawnContext,
    _layer: ResolvedObjectLayer,
    obj: ResolvedObject,
  ): Entity {
    const alias = ctx.tilemapConfig.objectTypes[obj.type ?? ''];
    const { w, h } = resolveSize(obj, ctx.resolvedMap.tilewidth, ctx.tilemapConfig);
    const { cx, cy, rotation } = resolveTransform(obj, w, h);

    // 1. Базовый entity (Transform + Velocity)
    const id = createBaseEntity(ctx, cx, cy, rotation);

    // 2. Shape → ShapeComponent (без Sprite, форма хранится отдельно)
    if (attachShapeIfPresent(ctx, id, obj)) {
      const shape = extractShape(obj)!;
      return spawnShapeObject(ctx, id, shape, obj);
    }

    // 3. Player setup callback — передаётся в spawn*-функции, выполняется ВНУТРИ
    //    finalizeSpawn ПОСЛЕ создания SpriteComponent. Это критично: setupPlayerAnimation
    //    подменяет `SpriteComponent.view` (Sprite → AnimatedSprite) и добавляет
    //    InputComponent/Animation — все эти операции требуют, чтобы SpriteComponent
    //    уже существовал.
    const isPlayer = obj.type === 'player_spawn' || alias === 'player';
    const onPlayer = isPlayer ? (playerId: Entity) => setupPlayerAnimation(ctx, playerId) : undefined;

    // 4. Dispatch по типу объекта (text / tile / rect)
    return ObjectSpawner.#dispatchByType(ctx, id, obj, w, h, alias, onPlayer);
  }

  /**
   * 🎯 Dispatch по типу Tiled-объекта (text / tile / rect).
   */
  static #dispatchByType(
    ctx: SpawnContext,
    id: Entity,
    obj: ResolvedObject,
    w: number,
    h: number,
    alias: string | undefined,
    onPlayer: ((id: Entity) => void) | undefined,
  ): Entity {
    // 1. Text object (приоритет — у text есть obj.text, но нет sprite)
    if (obj.text) {
      return spawnTextObject(ctx, id, obj, w, h);
    }

    // 2. Tile object (obj.tile — текстура из tileset с flip-флагами)
    if (obj.tile) {
      return spawnTileObject(ctx, id, obj, w, h, onPlayer);
    }

    // 3. Rectangle object (alias → Texture из AssetsManager)
    return spawnRectObject(ctx, id, obj, w, h, alias, onPlayer);
  }
}
