import { Container, Sprite } from 'pixi.js';
import { getIcons16Texture } from '../../assets/icons16Atlas';
import { bindDraggableSprite } from '../../components/draggableIcons';
import { ITEM_DEFINITIONS } from './itemData';
import {
  positionItemInfoPanel,
  toggleItemInfo,
  type ItemInfoBinding,
} from './itemInfoPanel';

type Point = {
  x: number;
  y: number;
};

type CreateItemIconsLayerOptions = {
  world: Container;
  screenToCanvasPoint: (screenX: number, screenY: number) => Point;
  getWorldPoint: (canvasX: number, canvasY: number) => Point;
  notebookPageInset: number;
  notebookPageScale: number;
  iconDisplayScale: number;
  iconRowY: number;
  iconStartX: number;
  iconGap: number;
};

export type ItemLayers = {
  iconsLayer: Container;
  itemInfoLayer: Container;
};

export async function createItemIconsLayer(
  options: CreateItemIconsLayerOptions,
): Promise<ItemLayers> {
  // данные
  const iconsLayer = new Container();
  const itemInfoLayer = new Container();
  const iconWorldSize = 16 * options.iconDisplayScale;
  const itemInfoPanelOffsetX = iconWorldSize;
  const itemInfoPanelOffsetY = -options.notebookPageInset;
  let activeBinding: ItemInfoBinding | null = null;

  options.world.addChild(iconsLayer);
  options.world.addChild(itemInfoLayer);
  for (let i = 0; i < ITEM_DEFINITIONS.length; i += 1) {
    const definition = ITEM_DEFINITIONS[i];
    const texture = await getIcons16Texture(definition.id);
    const iconSprite = new Sprite(texture);
    const binding: ItemInfoBinding = {
      definition,
      icon: iconSprite,
    };

    iconSprite.scale.set(options.iconDisplayScale);
    iconSprite.position.set(
      options.iconStartX + i * options.iconGap,
      options.iconRowY,
    );

    iconsLayer.addChild(iconSprite);
    bindDraggableSprite(
      iconSprite,
      options.screenToCanvasPoint,
      options.getWorldPoint,
      {
        stackParent: iconsLayer,
        onDragStart: () => {
          if (activeBinding?.definition.id === definition.id && binding.infoPanel) {
            itemInfoLayer.addChild(binding.infoPanel);
          }
        },
        onDragMove: () => {
          if (activeBinding?.definition.id === definition.id) {
            positionItemInfoPanel(binding, {
              offsetX: itemInfoPanelOffsetX,
              offsetY: itemInfoPanelOffsetY,
              snapStep: options.iconDisplayScale,
            });
          }
        },
        onDragEnd: () => {
          if (activeBinding?.definition.id === definition.id) {
            positionItemInfoPanel(binding, {
              offsetX: itemInfoPanelOffsetX,
              offsetY: itemInfoPanelOffsetY,
              snapStep: options.iconDisplayScale,
              snapToPixelGrid: true,
            });
          }
        },
        onDoubleClick: async () => {
          activeBinding = await toggleItemInfo(binding, activeBinding, itemInfoLayer, {
            offsetX: itemInfoPanelOffsetX,
            offsetY: itemInfoPanelOffsetY,
            snapStep: options.iconDisplayScale,
          }, {
            notebookPageInset: options.notebookPageInset,
            notebookPageScale: options.notebookPageScale,
          });
        },
      },
    );
  }

  return {
    iconsLayer,
    itemInfoLayer,
  };
}
