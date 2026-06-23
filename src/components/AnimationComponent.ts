import { AnimatedSprite } from 'pixi.js';
import { Component } from '../core/ecs';
import type { AnimationDefinitionComponent, Facing } from './AnimationDefinitionComponent';

/**
 * 🎬 Состояние анимации entity (плеер, NPC, монстры).
 *
 * Хранит:
 * - текущее {@link currentState} и {@link facing}
 * - счётчики времени (`stateTime`, `attackLockTime`)
 * - ссылку на {@link AnimatedSprite} (body) — кадры меняются здесь
 *
 * `AnimationSystem` каждый кадр:
 * - определяет желаемый state (по velocity + input)
 * - переключает через {@link setState} при необходимости
 * - обновляет facing по направлению движения
 * - вызывает {@link update} для листания кадров
 */
export class AnimationComponent extends Component {
  static readonly typeId = Symbol('AnimationComponent');

  /** 🎞️ Текущее состояние: `'idle'`, `'walk'`, `'run'`, `'attack'`, `'hurt'`, `'death'`, ... */
  currentState: string = 'idle';

  /** 🧭 Текущее направление (для выбора набора кадров). */
  facing: Facing = 'front';

  /** ⏱️ Сколько секунд прошло с начала текущей state. Используется для смены кадров. */
  stateTime: number = 0;

  /** ⏱️ Сколько секунд осталось до окончания attack. Пока > 0 — повторный Space игнорируется. */
  attackLockTime: number = 0;

  /** ⚔️ true, пока attack-анимация играет (mirror для быстрого check). */
  attacking: boolean = false;

  /** 🖼️ Спрайт, на котором проигрывается анимация. Должен быть добавлен в `worldContainer` спавнером. */
  body: AnimatedSprite;

  /** ⚡ Множитель скорости анимации (1 = нормально, 0.5 = замедленно). */
  speed: number = 1;

  /**
   * @param body - AnimatedSprite, заранее сконфигурированный (anchor, scale)
   * @param def - определения анимаций (для `attackDuration`)
   */
  constructor(body: AnimatedSprite, def: AnimationDefinitionComponent) {
    super();
    this.body = body;
    // 🎮 Управляем кадрами вручную через `stateTime` в `update()` —
    //    Pixi auto-play выключаем, чтобы не было двойного продвижения.
    body.animationSpeed = 0;
    body.autoUpdate = false;
    // Инициализируем кадры начальным состоянием
    this.refreshFrames(def);
  }

  /**
   * 🔄 Переключает state. Сбрасывает `stateTime` и обновляет кадры на `body`.
   *
   * @param state - новое состояние (`'idle'`, `'walk'`, ...). Если state нет в `def.states` — no-op + warn.
   * @param def - определения анимаций
   * @param reset - сбросить `stateTime` (true по умолчанию, false = сохранить при interruption)
   */
  setState(state: string, def: AnimationDefinitionComponent, reset = true): void {
    if (state === this.currentState) return;
    this.currentState = state;
    if (reset) this.stateTime = 0;
    this.refreshFrames(def);
  }

  /**
   * 🖼️ Обновляет кадры `body` по текущему `currentState` + `facing`.
   * Если frames для state или facing пусты — оставляет текущие кадры, warn.
   */
  refreshFrames(def: AnimationDefinitionComponent): void {
    const stateDef = def.states[this.currentState];
    if (!stateDef) {
      console.warn(`[AnimationComponent] Unknown state "${this.currentState}"`);
      return;
    }
    const frames = stateDef.frames[this.facing];
    if (!frames || frames.length === 0) {
      console.warn(`[AnimationComponent] No frames for state="${this.currentState}" facing="${this.facing}"`);
      return;
    }
    this.body.textures = frames;
    this.body.loop = stateDef.loop;
    this.body.gotoAndStop(0);
  }

  /**
   * ⚔️ Триггер attack-анимации. Защищён от повторного вызова (если уже идёт — no-op).
   * @param def - определения анимаций (для `attackDuration` и кадров)
   */
  triggerAttack(def: AnimationDefinitionComponent): void {
    if (this.attacking) return;
    if (!def.states.attack) {
      console.warn('[AnimationComponent] No "attack" state in definition');
      return;
    }
    this.attacking = true;
    this.attackLockTime = def.attackDuration;
    this.setState('attack', def);
  }

  /**
   * ⏱️ Продвигает анимацию на `dt` секунд. Вызывается из `AnimationSystem`.
   * - attack-lock countdown
   * - листание кадров через `stateTime` (используя `body.animationSpeed`)
   *
   * @param def - определения анимаций (для frameTime)
   * @param dt - время с прошлого шага, сек
   */
  update(def: AnimationDefinitionComponent, dt: number): void {
    // 1. Attack-lock countdown
    if (this.attackLockTime > 0) {
      this.attackLockTime -= dt;
      if (this.attackLockTime <= 0) {
        this.attackLockTime = 0;
        this.attacking = false;
      }
    }

    // 2. Frame advancement через stateTime + animationSpeed Pixi
    this.stateTime += dt;
    const stateDef = def.states[this.currentState];
    if (!stateDef || !this.body.textures.length) return;
    // body.animationSpeed — кадров в секунду * (1 / frameTime)? Нет, Pixi
    // animationSpeed — множитель; реальная скорость = animationSpeed / (1/fps).
    // Мы используем свой stateTime + ручной gotoAndStop для точного контроля.
    const fps = 1 / stateDef.frameTime;
    const totalFrames = this.body.textures.length;
    const desiredFrame = Math.floor(this.stateTime * fps);
    if (stateDef.loop) {
      const frame = ((desiredFrame % totalFrames) + totalFrames) % totalFrames;
      if (this.body.currentFrame !== frame) this.body.gotoAndPlay(frame);
    } else {
      const frame = Math.min(desiredFrame, totalFrames - 1);
      if (this.body.currentFrame !== frame) this.body.gotoAndStop(frame);
    }
  }
}
