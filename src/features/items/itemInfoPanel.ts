import { Container, Sprite, type BitmapText } from 'pixi.js';
import { createNotebookPage } from '../../components/NotebookPage';
import { snapToNearestStep } from '../../utils/math';
import { createGameBitmapText } from '../fonts/gameBitmapText';
import { startBitmapTypewriter } from '../fonts/typewriterBitmapText';
import type { ItemDefinition } from './itemData';

export type ItemInfoBinding = {
  definition: ItemDefinition;
  icon: Sprite;
  infoPanel?: Container;
  titleLabel?: BitmapText;
  descriptionLabel?: BitmapText;
  /** Остановка анимаций заголовка и описания. */
  cancelTypewriter?: () => void;
};

type CreateItemInfoPanelOptions = {
  notebookPageInset: number;
  notebookPageScale: number;
};

type PositionItemInfoPanelOptions = {
  offsetX: number;
  offsetY: number;
  snapStep: number;
  snapToPixelGrid?: boolean;
};

const ITEM_TYPEWRITER_MS = 36;

// создает открывающуюся блокнотную страницу
export async function createItemInfoPanel(
  _definition: ItemDefinition,
  options: CreateItemInfoPanelOptions,
): Promise<{
  panel: Container;
  titleLabel: BitmapText;
  descriptionLabel: BitmapText;
}> {
  const panel = new Container();
  const panelBackground = await createNotebookPage({
    x: options.notebookPageInset,
    y: options.notebookPageInset,
    scale: options.notebookPageScale,
  });
  const titleLabel = createGameBitmapText({
    text: '',
    face: 'bold',
    size: 18,
    maxWidth: 92,
    align: 'left',
  });
  const descriptionLabel = createGameBitmapText({
    text: '',
    face: 'sans',
    size: 9,
    maxWidth: 120,
    align: 'left',
  });

  titleLabel.position.set(50, 32);
  descriptionLabel.position.set(50, 66);

  panel.addChild(panelBackground);
  panel.addChild(titleLabel);
  panel.addChild(descriptionLabel);
  panel.visible = false;

  return { panel, titleLabel, descriptionLabel };
}

// для перемещения предмета по странице
// (четкое попадание по сетке snapToNearestStep
// вызывается при опускании мыши после перетягивания
export function positionItemInfoPanel(
  binding: ItemInfoBinding,
  options: PositionItemInfoPanelOptions,
): void {
  if (!binding.infoPanel) {
    return;
  }
  const nextX = binding.icon.x + options.offsetX;
  const nextY = binding.icon.y + options.offsetY;
  const panelX = options.snapToPixelGrid
    ? snapToNearestStep(nextX, options.snapStep)
    : nextX;
  const panelY = options.snapToPixelGrid
    ? snapToNearestStep(nextY, options.snapStep)
    : nextY;

  binding.infoPanel.position.set(panelX, panelY);
}

export function closeItemInfo(
  activeBinding: ItemInfoBinding | null,
): ItemInfoBinding | null {
  if (!activeBinding) {
    return null;
  }

  //отмена печати
  activeBinding.cancelTypewriter?.();
  activeBinding.cancelTypewriter = undefined;

  // удаление свойств активного предмета
  if (activeBinding.infoPanel) {
    activeBinding.infoPanel.parent?.removeChild(activeBinding.infoPanel);
    activeBinding.infoPanel.destroy({ children: true });
    activeBinding.infoPanel = undefined;
    activeBinding.titleLabel = undefined;
    activeBinding.descriptionLabel = undefined;
  }

  return null;
}

export async function openItemInfo(
  binding: ItemInfoBinding,
  activeBinding: ItemInfoBinding | null,
  itemInfoLayer: Container,
  positionOptions: Omit<PositionItemInfoPanelOptions, 'snapToPixelGrid'>,
  panelOptions: CreateItemInfoPanelOptions,
): Promise<ItemInfoBinding> {
  if (activeBinding && activeBinding !== binding) {
    closeItemInfo(activeBinding);
  }

  if (!binding.infoPanel) {
    const { panel, titleLabel, descriptionLabel } = await createItemInfoPanel(
      binding.definition,
      panelOptions,
    );
    binding.infoPanel = panel;
    binding.titleLabel = titleLabel;
    binding.descriptionLabel = descriptionLabel;
  }

  binding.cancelTypewriter?.();

  const cancelTitle = startBitmapTypewriter(
    binding.titleLabel!,
    binding.definition.title,
    { msPerStep: ITEM_TYPEWRITER_MS, charsPerStep: 1, blinkingCaret: true, },
  );
  const cancelDescription = startBitmapTypewriter(
    binding.descriptionLabel!,
    binding.definition.description,
    {
      msPerStep: ITEM_TYPEWRITER_MS,
      charsPerStep: 1,
      blinkingCaret: true,
      caretBlinkMs: 400,
    },
  );

  binding.cancelTypewriter = () => {
    cancelTitle();
    cancelDescription();
  };

  itemInfoLayer.addChild(binding.infoPanel);
  positionItemInfoPanel(binding, {
    ...positionOptions,
    snapToPixelGrid: true,
  });
  binding.infoPanel.visible = true;

  return binding;
}

// переключить на другой элемент меню
export async function toggleItemInfo(
  binding: ItemInfoBinding,
  activeBinding: ItemInfoBinding | null,
  itemInfoLayer: Container,
  positionOptions: Omit<PositionItemInfoPanelOptions, 'snapToPixelGrid'>,
  panelOptions: CreateItemInfoPanelOptions,
): Promise<ItemInfoBinding | null> {
  if (activeBinding === binding) {
    return closeItemInfo(activeBinding);
  }

  return openItemInfo(binding, activeBinding, itemInfoLayer, positionOptions, panelOptions);
}
