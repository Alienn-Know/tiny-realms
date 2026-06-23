import { Component } from '../core/ecs';

export class VelocityComponent extends Component {
  static readonly typeId = Symbol('VelocityComponent');

  constructor(
    public vx = 0,
    public vy = 0
  ) {
    super();
  }
}
