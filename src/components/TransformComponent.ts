import { Component } from '../core/ecs';

export class TransformComponent extends Component {
  prevX = 0;
  prevY = 0;
  prevRotation = 0;

  renderX = 0;
  renderY = 0;
  renderRotation = 0;

  constructor(
    public x = 0,
    public y = 0,
    public rotation = 0,
    public scale = 1
  ) {
    super();
    this.prevX = x;
    this.prevY = y;
    this.prevRotation = rotation;
    this.renderX = x;
    this.renderY = y;
    this.renderRotation = rotation;
  }
}
