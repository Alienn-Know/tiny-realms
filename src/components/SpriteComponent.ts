import { Container } from 'pixi.js';
import { Component } from '../core/ecs';

export class SpriteComponent extends Component {
  constructor(public view: Container) {
    super();
  }
}
