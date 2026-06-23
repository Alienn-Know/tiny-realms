import type { Application } from 'pixi.js';
import { TransformComponent } from '../../components/TransformComponent';
import { World } from '../ecs/World';

/**
 * 🔁 Главный игровой цикл с **фиксированным шагом** и **интерполяцией**.
 *
 * Логика (`world.update`) выполняется стабильными шагами по `fixedDt` секунд —
 * одинаково на 60 Hz, 144 Hz и при лагах. Рендер получает `alpha` для
 * плавной интерполяции между предыдущим и текущим состоянием.
 *
 * 📌 Паттерн: Glenn Fiedler "Fix Your Timestep".
 */
export class GameLoop {
  /** ⏱️ Длительность одного логического шага (60 шагов/сек). */
  private fixedDt = 1 / 60;

  /** 📦 Накопитель «недоигранного» времени, чтобы не терять кадры. */
  private accumulator = 0;

  /** 🕒 Время прошлого кадра в мс (`performance.now()`). */
  private lastTime = 0;

  /** ▶️ Флаг активности цикла. Останавливает `requestAnimationFrame`-цепочку. */
  private running = false;

  /**
   * @param world - мир ECS, чьи системы будут обновляться каждый шаг
   * @param app - PixiJS Application, чей `render()` вызывается для отрисовки
   */
  constructor(
    private world: World,
    private app: Application
  ) {}

  /** ▶️ Запускает цикл. Безопасно вызывать повторно — стартует с текущего момента. */
  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((time) => this.tick(time));
  }

  /** ⏸️ Останавливает цикл. Текущий `tick` завершится, новый не начнётся. */
  stop(): void {
    this.running = false;
  }

  /**
   * 🔄 Внутренний шаг цикла. Вызывается браузером через `requestAnimationFrame`.
   *
   * Алгоритм:
   * 1. Считает реальный dt кадра.
   * 2. Копит в `accumulator` и прогоняет столько фиксированных шагов,
   *    сколько «помещается» (чтобы на медленных машинах логика не отставала).
   * 3. Считает `alpha` ∈ [0, 1) — долю времени до следующего шага.
   * 4. Передаёт `alpha` в {@link render} для интерполяции.
   * @param time - текущее время в мс от `performance.now()`
   */
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

  /**
   * 💾 Снимок состояний `Transform` ДО логического шага.
   *
   * Нужен для интерполяции в {@link render}: знаем, где был объект и где стал,
   * между ними рисуем промежуточное состояние.
   */
  private savePreviousTransforms(): void {
    for (const entity of this.world.getEntitiesWith(TransformComponent)) {
      const transform = this.world.getComponent(entity, TransformComponent)!;
      transform.prevX = transform.x;
      transform.prevY = transform.y;
      transform.prevRotation = transform.rotation;
    }
  }

  /**
   * 🎨 Интерполирует визуальное состояние и вызывает `app.render()`.
   *
   * Формула: `render = prev + (current - prev) * alpha`.
   * При `alpha = 0` видно прошлый кадр, при `alpha → 1` — текущий.
   * @param alpha - доля времени до следующего логического шага, ∈ [0, 1)
   */
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
