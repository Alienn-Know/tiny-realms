import type { Container } from 'pixi.js';
import type { TiledMap } from 'pixi-tiledmap';
import {
  CameraInputSystem,
  CameraRenderSystem,
  CameraSystem,
  TouchCameraInputSystem,
} from '../camera';
import { PLAYER_SPEED } from '../config/camera.config';
import { World } from '../core/ecs';
import { CollisionGrid } from '../map/CollisionGrid';
import { AnimationSystem } from './AnimationSystem';
import { InputSystem } from './InputSystem';
import { MovementSystem } from './MovementSystem';
import { PlayerControlSystem } from './PlayerControlSystem';
import { RenderSystem } from './RenderSystem';

/**
 * 🕹️ Контекст для регистрации систем в `World`.
 */
export type SystemsContext = {
  /** 🌍 Контейнер, в котором живут все игровые объекты (для `CameraRenderSystem`). */
  worldContainer: Container;
  /** 🗺️ Загруженный TiledMap (для `CameraRenderSystem` parallax). */
  tiledMap: TiledMap;
  /** 🛡️ Collision grid (для `PlayerControlSystem`). */
  collision: CollisionGrid;
};

/**
 * 🕹️ Зарегистрировать все игровые системы в `World`.
 *
 * Порядок важен:
 * 1. `InputSystem` — собрать ввод с клавиатуры
 * 2. `PlayerControlSystem` — intent (куда хочет идти) на основе ввода
 * 3. `MovementSystem` — physics: velocity + collision
 * 4. `AnimationSystem` — обновить кадры анимации
 * 5. `CameraInputSystem` / `TouchCameraInputSystem` — собрать zoom-ввод
 * 6. `CameraSystem` — обновить логику камеры (follow, spring, clamp)
 * 7. `CameraRenderSystem` — применить камеру к `worldContainer`
 * 8. `RenderSystem` — sprite transforms (pos/scale)
 */
export function registerGameSystems(world: World, ctx: SystemsContext): void {
  // 🎮 Input → Intent → Physics
  world.addSystem(new InputSystem());
  world.addSystem(new PlayerControlSystem(PLAYER_SPEED, ctx.collision));
  world.addSystem(new MovementSystem());
  world.addSystem(new AnimationSystem());

  // 📷 Camera pipeline
  world.addSystem(new CameraInputSystem(world));
  world.addSystem(new TouchCameraInputSystem(world));
  world.addSystem(new CameraSystem());
  world.addSystem(new CameraRenderSystem(ctx.worldContainer, ctx.tiledMap));

  // 🖼️ Final render
  world.addSystem(new RenderSystem());
}
