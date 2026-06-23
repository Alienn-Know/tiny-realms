import { Texture } from 'pixi.js';
import { Component } from '../core/ecs';

/** 🧭 Направление анимации (4-direction top-down). */
export type Facing = 'front' | 'back' | 'left' | 'right';

/** 🎞️ Набор кадров для одного направления. */
export type FacingFrames = Record<Facing, Texture[]>;

/** 🎬 Описание одной анимации (например, `walk` или `attack`). */
export type AnimationDef = {
  /** 🖼️ Кадры по направлениям. Пустой массив = placeholder (setState будет no-op). */
  frames: FacingFrames;
  /** ⏱️ Время одного кадра в секундах. */
  frameTime: number;
  /** 🔁 true = зацикливать (idle/walk/run), false = один раз (attack/hurt/death). */
  loop: boolean;
};

/**
 * 🎬 Хранит описания всех анимаций для entity.
 *
 * Генерируется при спавне из spritesheet JSON (`slime3.json`) и хранит
 * уже разрезанные по facing текстуры. {@link AnimationComponent} использует
 * эти данные для проигрывания кадров.
 *
 * Расширяемость: под новые состояния (например `fly` для дракона) достаточно
 * добавить ключ в {@link states} с пустыми/непустыми frames. У других
 * существ (без `fly`) этот ключ просто отсутствует — `setState('fly')`
 * будет no-op с warn.
 */
export class AnimationDefinitionComponent extends Component {
  static readonly typeId = Symbol('AnimationDefinitionComponent');

  /** 📚 Маппинг: имя state → определение. Ключи: `idle`, `walk`, `run`, `attack`, `hurt`, `death`, ... */
  states: Record<string, AnimationDef>;

  /**
   * ⏱️ Длительность attack-анимации (для блокировки повторного триггера).
   * Вычисляется из `states.attack.framesCount * frameTime`.
   * Если attack отсутствует — 0.
   */
  attackDuration: number;

  /**
   * @param states - маппинг state → AnimationDef
   */
  constructor(states: Record<string, AnimationDef>) {
    super();
    this.states = states;
    const attack = states.attack;
    if (attack) {
      const sampleFacing = attack.frames.front;
      this.attackDuration = (sampleFacing?.length ?? 0) * attack.frameTime;
    } else {
      this.attackDuration = 0;
    }
  }
}
