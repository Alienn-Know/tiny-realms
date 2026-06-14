import { Component } from '../core/ecs';

export class VelocityComponent extends Component {
  constructor(
    public vx = 0,
    public vy = 0
  ) {
    super();
  }
}
