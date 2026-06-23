import { Component } from '../core/ecs';
import type { TiledPoint } from '../map/TiledTypes';

/**
 * 📐 ShapeComponent — хранит геометрическую форму Tiled-объекта.
 *
 * Tiled object shapes: point, ellipse, polygon, polyline, capsule, rectangle.
 * Rectangle обрабатывается через `SizeComponent`, здесь — остальные формы.
 *
 * Используется:
 * - ShapeRenderSystem (дебаг-отрисовка через Pixi Graphics)
 * - CollisionGrid (расширение для не-AABB форм — TODO)
 */

/** 🎨 Тип формы. */
export type ShapeKind = 'point' | 'ellipse' | 'polygon' | 'polyline' | 'capsule';

/** 📐 Данные формы. */
export type ShapeData =
  | { kind: 'point' }
  | { kind: 'ellipse'; width: number; height: number }
  | { kind: 'capsule'; width: number; height: number }
  | { kind: 'polygon'; points: TiledPoint[] }
  | { kind: 'polyline'; points: TiledPoint[] };

export class ShapeComponent extends Component {
  static readonly typeId = Symbol('ShapeComponent');

  constructor(public shape: ShapeData) {
    super();
  }
}
