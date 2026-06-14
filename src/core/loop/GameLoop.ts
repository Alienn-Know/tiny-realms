import type { Application } from 'pixi.js';
import { TransformComponent } from '../../components/TransformComponent';
import { World } from '../ecs/World';

export class GameLoop {
  private fixedDt = 1 / 60;
  private accumulator = 0;
  private lastTime = 0;
  private running = false;

  constructor(
    private world: World,
    private app: Application
  ) {}

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((time) => this.tick(time));
  }

  stop(): void {
    this.running = false;
  }

  private tick(time: number): void {
    if (!this.running) return;

    const frameDt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    this.accumulator += frameDt;

    while (this.accumulator >= this.fixedDt) {
      this.savePreviousTransforms();
      this.world.update(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    const alpha = this.accumulator / this.fixedDt;
    this.render(alpha);

    requestAnimationFrame((nextTime) => this.tick(nextTime));
  }

  private savePreviousTransforms(): void {
    for (const entity of this.world.getEntitiesWith(TransformComponent)) {
      const transform = this.world.getComponent(entity, TransformComponent)!;
      transform.prevX = transform.x;
      transform.prevY = transform.y;
      transform.prevRotation = transform.rotation;
    }
  }

  private render(alpha: number): void {
    for (const entity of this.world.getEntitiesWith(TransformComponent)) {
      const transform = this.world.getComponent(entity, TransformComponent)!;
      transform.renderX = transform.prevX + (transform.x - transform.prevX) * alpha;
      transform.renderY = transform.prevY + (transform.y - transform.prevY) * alpha;
      transform.renderRotation = transform.prevRotation + (transform.rotation - transform.prevRotation) * alpha;
    }

    this.app.render();
  }
}
