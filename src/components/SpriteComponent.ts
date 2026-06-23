import { Container } from 'pixi.js';
import { Component } from '../core/ecs';

export class SpriteComponent extends Component {
  static readonly typeId = Symbol('SpriteComponent');

  constructor(public view: Container) {
    super();
  }
}
