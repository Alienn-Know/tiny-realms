import { Container, type Application } from 'pixi.js';
import type { ResolvedMap, TiledMap } from 'pixi-tiledmap';
import { CollisionGrid } from './CollisionGrid';

/**
 * 🌍 Создать `worldContainer` и добавить в него тайлмап.
 *
 * Все игровые объекты (спрайты, эффекты) — дети этого контейнера.
 * `CameraRenderSystem` управляет его `scale` и `position`.
 */
export function createWorldContainer(app: Application, tiledMap: TiledMap): Container {
  const container = new Container();
  app.stage.addChild(container);
  container.addChild(tiledMap);
  return container;
}

/**
 * 🛡️ Создать `CollisionGrid` из resolved Tiled map.
 *
 * Используется в `PlayerControlSystem` для блокировки движения сквозь стены.
 */
export function createCollisionGrid(mapData: ResolvedMap): CollisionGrid {
  return new CollisionGrid(mapData, 'walkable');
}
