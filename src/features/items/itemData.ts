import type { Icons16Name } from '../../assets/icons16Atlas';

export type ItemDefinition = {
  id: Icons16Name;
  title: string;
  description: string;
};

export const ITEM_DEFINITIONS: ItemDefinition[] = [
  {
    id: 'apple',
    title: 'Apple',
    description: 'A bright fruit with a crisp bite.',
  },
  {
    id: 'grapes',
    title: 'Grapes',
    description: 'A clustered snack gathered for the road.',
  },
  {
    id: 'watermelon',
    title: 'Watermelon',
    description: 'A juicy slice that feels heavy in the bag.',
  },
  {
    id: 'potionRed',
    title: 'Red Potion',
    description: 'A classic bottle used to recover strength.',
  },
  {
    id: 'scroll',
    title: 'Scroll',
    description: 'A rolled note with tiny handwritten marks.',
  },
  {
    id: 'swordSteel',
    title: 'Steel Sword',
    description: 'A balanced blade kept ready for close combat.',
  },
  {
    id: 'shieldSmall',
    title: 'Small Shield',
    description: 'A compact shield meant for quick defense.',
  },
  {
    id: 'gemBlue',
    title: 'Blue Gem',
    description: 'A polished stone that catches every bit of light.',
  },
];
