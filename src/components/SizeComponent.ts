import { Component } from '../core/ecs';

/**
 * 📦 Хранит размер entity в мировых единицах (без зависимости от Pixi).
 *
 * Выделен из `SpriteComponent`, чтобы системы физики/границ (`BoundarySystem`,
 * будущие collision-системы) не лезли в `view.getLocalBounds()` каждый кадр —
 * это дорого (рекурсивный обход детей `Container` + аллокация `Rectangle`).
 *
 * Размер меняется редко (смена скина, spawn-анимация, resize), поэтому его
 * кэшируем в компоненте и обновляем явным вызовом {@link setSize} или
 * {@link refreshFromView}.
 *
 * Контракт: хранятся **половины** ширины/высоты (half-extents), т.к. именно
 * они нужны для AABB-проверок и clamp'а к границам. Полный размер = `2 * half`.
 */
export class SizeComponent extends Component {
  static readonly typeId = Symbol('SizeComponent');

  /** 📏 Половина ширины в мировых единицах (half-extent по X). */
  halfWidth: number;

  /** 📐 Половина высоты в мировых единицах (half-extent по Y). */
  halfHeight: number;

  /**
   * @param halfWidth - половина ширины (или полная ширина, если `fromFull=true`)
   * @param halfHeight - половина высоты (или полная высота, если `fromFull=true`)
   * @param fromFull - если `true`, аргументы трактовать как полный размер и
   *   разделить на 2 (удобно при создании: `new SizeComponent(48, 48, true)`)
   */
  constructor(halfWidth: number, halfHeight: number, fromFull = false) {
    super();
    if (fromFull) {
      this.halfWidth = halfWidth / 2;
      this.halfHeight = halfHeight / 2;
    } else {
      this.halfWidth = halfWidth;
      this.halfHeight = halfHeight;
    }
  }

  /**
   * 🔄 Явно задать новый размер (half-extents).
   * @param halfWidth - половина ширины
   * @param halfHeight - половина высоты
   */
  setSize(halfWidth: number, halfHeight: number): void {
    this.halfWidth = halfWidth;
    this.halfHeight = halfHeight;
  }
}
