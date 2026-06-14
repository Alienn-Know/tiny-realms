import { Container, Sprite } from 'pixi.js';
import { getUiTexture, type UiFrameName } from '../assets/uiAtlas';

type CreateNotebookPageOptions = {
  x?: number;
  y?: number;
  scale?: number;
  frameName?: UiFrameName;
};

// Просто создаёт Контейнер со спрайтом блокнотной страницы
export async function createNotebookPage({
  x = 0,
  y = 0,
  scale = 8,
  frameName = 'notebookPage',
}: CreateNotebookPageOptions = {}): Promise<Container> {
  // Wrap the sprite in a container so the component can grow later.
  const root = new Container();
  const texture = await getUiTexture(frameName);
  const page = new Sprite(texture);

  // Stick to integer scale values to keep pixel-art sharp.
  page.scale.set(scale);
  page.position.set(x, y);

  root.addChild(page);

  return root;
}
