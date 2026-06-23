import { System, World } from '../core/ecs';
import { TileMapComponent } from '../components/TileMapComponent';

/**
 * 🪃 TileAnimationSystem — продвигает кадры анимированных тайлов по dt.
 *
 * Итерирует per-layer: для каждого слоя проходит по всем тайлам,
 * проверяет наличие анимации и продвигает accumulator.
 * При смене кадра помечает `TileMapComponent.dirty = true`.
 */
export class TileAnimationSystem extends System {
  update(world: World, dt: number): void {
    const dtMs = dt * 1000;
    for (const entity of world.getEntitiesWith(TileMapComponent)) {
      const comp = world.getComponent(entity, TileMapComponent)!;
      const hasAnimated = comp.tilesets.some((ts) => ts.animationsByLocalId.size > 0);
      if (!hasAnimated) continue;

      for (let li = 0; li < comp.layers.length; li++) {
        const layer = comp.layers[li];
        for (let i = 0; i < layer.data.length; i++) {
          comp.advanceAnimation(i, li, dtMs);
        }
      }
    }
  }
}
