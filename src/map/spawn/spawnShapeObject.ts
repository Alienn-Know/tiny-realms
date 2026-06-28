import { SizeComponent } from '../../components/SizeComponent';
import type { ShapeData } from '../../components/ShapeComponent';
import type { ResolvedObject } from 'pixi-tiledmap';
import type { Entity } from '../../core/ecs';
import type { SpawnContext } from './spawnContext';
import { finalizeSpawn } from './spawnUtils';

/**
 * 📐 Спавн Shape object: `ShapeData` уже извлечён из объекта.
 *
 * Shape-объекты не имеют SpriteComponent (только геометрия).
 */
export function spawnShapeObject(
  ctx: SpawnContext,
  id: Entity,
  shape: ShapeData,
  obj: ResolvedObject,
): Entity {
  // Если у shape есть размеры (ellipse) — добавляем SizeComponent
  if (shape.kind === 'ellipse' && shape.width > 0 && shape.height > 0) {
    ctx.world.addComponent(id, new SizeComponent(shape.width, shape.height, true));
  }
  // Shape-объекты без текстуры — finalize всё равно нужен для properties/collision
  finalizeSpawn(ctx, id, obj, undefined);
  return id;
}
