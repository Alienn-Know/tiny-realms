import { PropertiesComponent } from '../../components/PropertiesComponent';
import { ShapeComponent, type ShapeData } from '../../components/ShapeComponent';
import { TransformComponent } from '../../components/TransformComponent';
import { VelocityComponent } from '../../components/VelocityComponent';
import type { Entity } from '../../core/ecs';
import type { ResolvedObject, TiledProperty } from 'pixi-tiledmap';
import type { TilemapConfig } from '../../core/assets/AssetsConfig';
import type { SpawnContext } from './spawnContext';

/**
 * 📐 Resolve width/height объекта с учётом `objectSizeFallback`.
 */
export function resolveSize(
  obj: ResolvedObject,
  tileSize: number,
  config: TilemapConfig,
): { w: number; h: number } {
  let w = obj.width;
  let h = obj.height;
  if (w <= 0 || h <= 0) {
    if (config.objectSizeFallback === 'tile') {
      w = w <= 0 ? tileSize : w;
      h = h <= 0 ? tileSize : h;
    } else if (config.objectSizeFallback === 'zero') {
      w = w <= 0 ? 0 : w;
      h = h <= 0 ? 0 : h;
    }
  }
  return { w, h };
}

/**
 * 📍 Центрировать позицию (Tiled origin = top-left → +w/2, +h/2) и ротацию.
 */
export function resolveTransform(
  obj: ResolvedObject,
  w: number,
  h: number,
): { cx: number; cy: number; rotation: number } {
  return {
    cx: obj.x + w / 2,
    cy: obj.y + h / 2,
    rotation: (obj.rotation * Math.PI) / 180,
  };
}

/**
 * 🏗️ Создать entity + базовые компоненты (Transform + Velocity).
 */
export function createBaseEntity(
  ctx: SpawnContext,
  cx: number,
  cy: number,
  rotation: number,
): Entity {
  const id = ctx.world.createEntity();
  ctx.world.addComponent(id, new TransformComponent(cx, cy, rotation));
  ctx.world.addComponent(id, new VelocityComponent());
  return id;
}

/**
 * 🏁 Финализация: properties + collision (solid) + player-setup (через callback).
 *
 * Вызывается ПОСЛЕ создания SpriteComponent — это важно для player setup,
 * который должен подменить `SpriteComponent.view` (Sprite → AnimatedSprite).
 *
 * @param onPlayer - опциональный callback, вызывается для player_spawn объектов.
 *                   Используется для player animation setup, который должен
 *                   выполниться после создания SpriteComponent.
 */
export function finalizeSpawn(
  ctx: SpawnContext,
  id: Entity,
  obj: ResolvedObject,
  alias: string | undefined,
  onPlayer?: (id: Entity) => void,
): void {
  // Player setup — вызывается ПОСЛЕ создания SpriteComponent в spawn*-функциях
  if ((obj.type === 'player_spawn' || alias === 'player') && onPlayer) {
    onPlayer(id);
  }

  addProperties(ctx, id, obj);

  // Solid object → collision grid
  const w = obj.width;
  const h = obj.height;
  const isSolid = obj.properties?.some((p) => p.name === 'solid' && p.value === true) ?? false;
  if (isSolid && w > 0 && h > 0) {
    const cx = obj.x + w / 2;
    const cy = obj.y + h / 2;
    ctx.collision.addSolidBox(id, cx, cy, w, h);
  }
}

/** 🏷️ Custom properties → PropertiesComponent. */
function addProperties(ctx: SpawnContext, id: Entity, obj: ResolvedObject): void {
  if (obj.properties && obj.properties.length > 0) {
    const data = propertiesToObject(obj.properties);
    ctx.world.addComponent(id, new PropertiesComponent(data));
  }
}

/** 📋 Tiled properties `[{name, type, value}]` → plain object. */
function propertiesToObject(props: TiledProperty[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of props) {
    out[p.name] = p.value;
  }
  return out;
}

/**
 * 📐 Извлечь ShapeData из объекта (если это shape-объект).
 */
export function extractShape(obj: ResolvedObject): ShapeData | null {
  if (obj.point) return { kind: 'point' };
  if (obj.ellipse) return { kind: 'ellipse', width: obj.width, height: obj.height };
  if (obj.polygon && obj.polygon.length > 0) return { kind: 'polygon', points: obj.polygon };
  if (obj.polyline && obj.polyline.length > 0) return { kind: 'polyline', points: obj.polyline };
  return null;
}

/**
 * 📎 Добавить ShapeComponent к entity (если есть shape).
 */
export function attachShapeIfPresent(ctx: SpawnContext, id: Entity, obj: ResolvedObject): boolean {
  const shape = extractShape(obj);
  if (shape) {
    ctx.world.addComponent(id, new ShapeComponent(shape));
    return true;
  }
  return false;
}
