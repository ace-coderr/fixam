/**
 * Everything Fixam can buy. Sizes are in 50cm cells: `w` runs along the wall
 * the item backs onto, `h` is its depth into the room. Wall-mounted items are
 * always one cell deep, since they take no floor.
 */

export type Category =
  | 'sleep'
  | 'seating'
  | 'light'
  | 'storage'
  | 'table'
  | 'desk'
  | 'media'
  | 'power'
  | 'cooling'
  | 'kitchen'
  | 'decor'
  | 'rug'
  | 'window';

export type Tag =
  | 'luxe'
  | 'budget'
  | 'starter'
  | 'minimal'
  | 'comfort'
  | 'traditional'
  | 'family'
  | 'hosting'
  | 'party'
  | 'food'
  | 'work'
  | 'tech'
  | 'study'
  | 'power'
  | 'cooling'
  | 'decor'
  | 'green';

/**
 * wall: back flush against a wall.  corner: touches two walls.
 * floor: anywhere with clearance.  wallmount: hangs on a wall, takes no floor.
 */
export type Placement = 'wall' | 'corner' | 'floor' | 'wallmount';

export type SpriteKind =
  | 'mattress' | 'campbed' | 'bed'
  | 'plasticchair' | 'sofa' | 'armchair' | 'bench' | 'cushions' | 'officechair'
  | 'lantern' | 'floorlamp' | 'solar' | 'sconce' | 'bracket'
  | 'wardrobe' | 'fabricwardrobe' | 'bags' | 'drawers' | 'bookshelf' | 'shoerack' | 'cabinet'
  | 'centretable' | 'stool' | 'dining'
  | 'desk' | 'workstation'
  | 'tvstand' | 'smalltv' | 'speaker' | 'walltv'
  | 'gen' | 'jerrycan' | 'inverter' | 'meter'
  | 'fan' | 'ac'
  | 'cooler' | 'fridge'
  | 'mirror' | 'plant' | 'pouf' | 'clock' | 'frames' | 'art' | 'calendar'
  | 'mat' | 'rug'
  | 'curtain' | 'blinds';

export interface Palette {
  base: string;
  accent: string;
  detail?: string;
}

/** Soft placement hints. The solver treats these as preferences, never as rules. */
export interface PlacementHints {
  door?: 'near' | 'far';
  near?: Category;
  centre?: boolean;
}

export interface CatalogueItem {
  id: string;
  name: string;
  naira: number;
  w: number;
  h: number;
  category: Category;
  tags: Tag[];
  placement: Placement;
  /** 1–10. How much this item matters to a working room. */
  priority: number;
  palette: Palette;
  sprite: SpriteKind;
  /** Tall items may not stand in front of the window. */
  tall?: boolean;
  /** Lies flat on the floor: walkable, and furniture may sit on it. */
  flat?: boolean;
  /** Hangs over the window opening and stretches to its width. */
  onWindow?: boolean;
  /** How many of this item one room can take. Defaults to 1. */
  maxQty?: number;
  /** Only worth buying if one of these item ids or categories is also bought. */
  needs?: string[];
  /** A supporting piece: small, cheap or flat. Used to fill out a sparse room. */
  support?: boolean;
  hints?: PlacementHints;
}

export const catalogue: CatalogueItem[] = [
  // Sleep
  {
    id: 'foam-mattress', name: 'Foam mattress on the floor', naira: 38_000, w: 3, h: 4,
    category: 'sleep', tags: ['budget', 'starter', 'minimal'], placement: 'wall', priority: 9,
    palette: { base: '#D7E0F0', accent: '#5B78B5' }, sprite: 'mattress', hints: { door: 'far' },
  },
  {
    id: 'camp-bed', name: 'Folding camp bed', naira: 18_000, w: 2, h: 4,
    category: 'sleep', tags: ['budget', 'starter'], placement: 'wall', priority: 8,
    palette: { base: '#6E7F45', accent: '#D4CDAE' }, sprite: 'campbed', hints: { door: 'far' },
  },
  {
    id: 'wooden-bed', name: 'Wooden bedframe and mattress', naira: 125_000, w: 4, h: 4,
    category: 'sleep', tags: ['comfort', 'family', 'traditional'], placement: 'wall', priority: 9,
    palette: { base: '#8A5A34', accent: '#ECE6F2', detail: '#B5523B' }, sprite: 'bed', hints: { door: 'far' },
  },
  {
    id: 'king-bed', name: 'Upholstered king bed', naira: 250_000, w: 4, h: 5,
    category: 'sleep', tags: ['luxe', 'comfort'], placement: 'wall', priority: 9,
    palette: { base: '#4B3F72', accent: '#F4F0E8', detail: '#C9A15A' }, sprite: 'bed', hints: { door: 'far' },
  },

  // Seating
  {
    id: 'plastic-chair', name: 'Plastic chair', naira: 4_500, w: 1, h: 1,
    category: 'seating', tags: ['budget', 'party', 'hosting', 'starter'], placement: 'floor', priority: 6,
    palette: { base: '#F7F6F1', accent: '#9AA0AA' }, sprite: 'plasticchair', maxQty: 4, support: true,
  },
  {
    id: 'sofa-three', name: 'Three-seater velvet sofa', naira: 185_000, w: 4, h: 2,
    category: 'seating', tags: ['luxe', 'comfort', 'hosting'], placement: 'wall', priority: 8,
    palette: { base: '#2F6B5E', accent: '#245247' }, sprite: 'sofa',
  },
  {
    id: 'sofa-two', name: 'Two-seater fabric sofa', naira: 85_000, w: 3, h: 2,
    category: 'seating', tags: ['comfort', 'family', 'minimal'], placement: 'wall', priority: 8,
    palette: { base: '#A0714A', accent: '#7C5534' }, sprite: 'sofa',
  },
  {
    id: 'cane-armchair', name: 'Cane armchair', naira: 28_000, w: 2, h: 2,
    category: 'seating', tags: ['traditional', 'green', 'comfort'], placement: 'corner', priority: 6,
    palette: { base: '#C99B57', accent: '#9C7337' }, sprite: 'armchair',
  },
  {
    id: 'wooden-bench', name: 'Wooden bench', naira: 22_000, w: 3, h: 1,
    category: 'seating', tags: ['traditional', 'hosting', 'party', 'budget'], placement: 'wall', priority: 5,
    palette: { base: '#9A6A3E', accent: '#74502D' }, sprite: 'bench',
  },
  {
    id: 'floor-cushions', name: 'Floor cushions, set of three', naira: 12_000, w: 2, h: 2,
    category: 'seating', tags: ['budget', 'minimal', 'comfort'], placement: 'floor', priority: 5,
    palette: { base: '#D98E3A', accent: '#3D5A99', detail: '#2E7D5B' }, sprite: 'cushions', support: true,
  },
  {
    id: 'office-chair', name: 'Swivel office chair', naira: 55_000, w: 1, h: 1,
    category: 'seating', tags: ['work', 'tech'], placement: 'floor', priority: 6,
    palette: { base: '#2A2E38', accent: '#565D70' }, sprite: 'officechair',
    needs: ['desk'], hints: { near: 'desk' },
  },
  {
    id: 'pouffe', name: 'Leather pouffe', naira: 15_000, w: 1, h: 1,
    category: 'seating', tags: ['luxe', 'decor', 'traditional', 'comfort'], placement: 'floor', priority: 4,
    palette: { base: '#8C4A2F', accent: '#C77A4E' }, sprite: 'pouf', maxQty: 2, support: true, hints: { near: 'seating' },
  },

  // Light
  {
    id: 'lantern', name: 'Rechargeable lantern', naira: 6_500, w: 1, h: 1,
    category: 'light', tags: ['budget', 'power', 'starter'], placement: 'floor', priority: 7,
    palette: { base: '#F2C744', accent: '#3A3F4A' }, sprite: 'lantern', hints: { near: 'sleep' },
  },
  {
    id: 'floor-lamp', name: 'Standing floor lamp', naira: 32_000, w: 1, h: 1,
    category: 'light', tags: ['luxe', 'comfort', 'decor', 'minimal'], placement: 'corner', priority: 6,
    palette: { base: '#EBD9A4', accent: '#6B5B3E' }, sprite: 'floorlamp', support: true,
  },
  {
    id: 'solar-kit', name: 'Solar lamp and panel kit', naira: 48_000, w: 1, h: 1,
    category: 'light', tags: ['power', 'tech', 'green'], placement: 'corner', priority: 6,
    palette: { base: '#2C4A7A', accent: '#F2C744' }, sprite: 'solar',
  },
  {
    id: 'brass-sconces', name: 'Brass wall sconces, pair', naira: 65_000, w: 3, h: 1,
    category: 'light', tags: ['luxe', 'party', 'decor'], placement: 'wallmount', priority: 5,
    palette: { base: '#C98A2B', accent: '#FFF1C9' }, sprite: 'sconce', support: true,
  },
  {
    id: 'bracket-light', name: 'Wall bracket light', naira: 9_000, w: 1, h: 1,
    category: 'light', tags: ['minimal', 'budget', 'starter'], placement: 'wallmount', priority: 5,
    palette: { base: '#DADDE3', accent: '#FFF4CF' }, sprite: 'bracket', support: true,
  },

  // Storage
  {
    id: 'wardrobe', name: 'Two-door wardrobe', naira: 95_000, w: 3, h: 1,
    category: 'storage', tags: ['comfort', 'family', 'traditional'], placement: 'wall', priority: 8,
    palette: { base: '#7A4E2D', accent: '#5C3920' }, sprite: 'wardrobe', tall: true,
  },
  {
    id: 'fabric-wardrobe', name: 'Zip-up fabric wardrobe', naira: 16_000, w: 2, h: 1,
    category: 'storage', tags: ['budget', 'starter', 'minimal'], placement: 'wall', priority: 7,
    palette: { base: '#6F8FAF', accent: '#4C6A88' }, sprite: 'fabricwardrobe', tall: true,
  },
  {
    id: 'ghana-must-go', name: 'Ghana Must Go bags, stack of three', naira: 3_000, w: 1, h: 1,
    category: 'storage', tags: ['budget', 'starter'], placement: 'corner', priority: 6,
    palette: { base: '#2F5EA8', accent: '#D24B3E', detail: '#F2F2F2' }, sprite: 'bags',
  },
  {
    id: 'chest-of-drawers', name: 'Chest of drawers', naira: 58_000, w: 2, h: 1,
    category: 'storage', tags: ['comfort', 'family', 'minimal'], placement: 'wall', priority: 6,
    palette: { base: '#B0855A', accent: '#8A6440' }, sprite: 'drawers',
  },
  {
    id: 'bookshelf', name: 'Bookshelf', naira: 42_000, w: 2, h: 1,
    category: 'storage', tags: ['study', 'work', 'minimal', 'decor'], placement: 'wall', priority: 5,
    palette: { base: '#6E4B2E', accent: '#C2452D', detail: '#3D5A99' }, sprite: 'bookshelf', tall: true,
  },
  {
    id: 'shoe-rack', name: 'Shoe rack', naira: 12_000, w: 2, h: 1,
    category: 'storage', tags: ['minimal', 'family'], placement: 'wall', priority: 4,
    palette: { base: '#4F5560', accent: '#B5523B' }, sprite: 'shoerack', hints: { door: 'near' },
  },
  {
    id: 'display-cabinet', name: 'Glass display cabinet', naira: 135_000, w: 3, h: 1,
    category: 'storage', tags: ['traditional', 'luxe', 'family', 'hosting'], placement: 'wall', priority: 6,
    palette: { base: '#5A3A22', accent: '#BFD8E0' }, sprite: 'cabinet', tall: true,
  },

  // Tables
  {
    id: 'centre-table', name: 'Glass centre table', naira: 38_000, w: 2, h: 2,
    category: 'table', tags: ['hosting', 'traditional', 'family', 'comfort'], placement: 'floor', priority: 6,
    palette: { base: '#BFD8E0', accent: '#8A6440' }, sprite: 'centretable', hints: { centre: true, near: 'seating' }, support: true,
  },
  {
    id: 'side-stool', name: 'Side stool', naira: 7_000, w: 1, h: 1,
    category: 'table', tags: ['budget', 'minimal', 'starter'], placement: 'floor', priority: 4,
    palette: { base: '#A8784A', accent: '#7C5534' }, sprite: 'stool', hints: { near: 'sleep' }, maxQty: 2, support: true,
  },
  {
    id: 'side-table', name: 'Round side table', naira: 18_000, w: 1, h: 1,
    category: 'table', tags: ['minimal', 'comfort', 'luxe'], placement: 'floor', priority: 4,
    palette: { base: '#D9C7A3', accent: '#6E4B2E' }, sprite: 'stool', support: true, hints: { near: 'seating' },
  },
  {
    id: 'dining-set', name: 'Dining table and four chairs', naira: 165_000, w: 3, h: 3,
    category: 'table', tags: ['family', 'hosting', 'luxe', 'food'], placement: 'floor', priority: 5,
    palette: { base: '#6B4426', accent: '#C9A15A' }, sprite: 'dining',
  },

  // Desks
  {
    id: 'study-desk', name: 'Study desk', naira: 45_000, w: 2, h: 1,
    category: 'desk', tags: ['study', 'work', 'starter', 'minimal'], placement: 'wall', priority: 6,
    palette: { base: '#C49A6C', accent: '#3A3F4A' }, sprite: 'desk',
  },
  {
    id: 'workstation', name: 'L-shaped workstation', naira: 150_000, w: 3, h: 2,
    category: 'desk', tags: ['work', 'tech', 'luxe'], placement: 'corner', priority: 7,
    palette: { base: '#3B3F48', accent: '#7FB7C9' }, sprite: 'workstation',
  },

  // Media
  {
    id: 'tv-stand', name: 'TV stand with 43-inch TV', naira: 210_000, w: 3, h: 1,
    category: 'media', tags: ['luxe', 'family', 'comfort', 'hosting'], placement: 'wall', priority: 6,
    palette: { base: '#4A3526', accent: '#151922' }, sprite: 'tvstand',
  },
  {
    id: 'small-tv', name: '24-inch TV on a stool', naira: 65_000, w: 1, h: 1,
    category: 'media', tags: ['starter', 'family'], placement: 'wall', priority: 5,
    palette: { base: '#A8784A', accent: '#151922' }, sprite: 'smalltv',
  },
  {
    id: 'party-speaker', name: 'Party speaker', naira: 75_000, w: 1, h: 1,
    category: 'media', tags: ['party', 'hosting'], placement: 'corner', priority: 5,
    palette: { base: '#22262E', accent: '#C2452D' }, sprite: 'speaker',
  },
  {
    id: 'wall-tv', name: 'Wall-mounted 55-inch TV', naira: 248_000, w: 3, h: 1,
    category: 'media', tags: ['luxe', 'tech'], placement: 'wallmount', priority: 5,
    palette: { base: '#151922', accent: '#3D5A99' }, sprite: 'walltv',
  },

  // Power
  {
    id: 'generator', name: 'Small petrol generator', naira: 95_000, w: 1, h: 1,
    category: 'power', tags: ['power'], placement: 'corner', priority: 5,
    palette: { base: '#D2452F', accent: '#2A2E38' }, sprite: 'gen', hints: { door: 'near' },
  },
  {
    id: 'jerry-can', name: 'Jerry can, 25 litres', naira: 3_500, w: 1, h: 1,
    category: 'power', tags: ['power', 'budget', 'starter'], placement: 'corner', priority: 3,
    palette: { base: '#E0B32E', accent: '#7A5E12' }, sprite: 'jerrycan',
    needs: ['generator'], hints: { door: 'near' },
  },
  {
    id: 'inverter', name: 'Inverter and battery', naira: 240_000, w: 2, h: 1,
    category: 'power', tags: ['tech', 'power', 'luxe', 'work'], placement: 'wall', priority: 5,
    palette: { base: '#E9EBEF', accent: '#2E7D5B' }, sprite: 'inverter',
  },
  {
    id: 'prepaid-meter', name: 'Prepaid meter', naira: 28_000, w: 1, h: 1,
    category: 'power', tags: ['power', 'starter'], placement: 'wallmount', priority: 6,
    palette: { base: '#E9EBEF', accent: '#2E7D5B' }, sprite: 'meter', hints: { door: 'near' },
  },

  // Cooling
  {
    id: 'rechargeable-fan', name: 'Rechargeable standing fan', naira: 38_000, w: 1, h: 1,
    category: 'cooling', tags: ['power', 'cooling', 'budget', 'starter'], placement: 'corner', priority: 7,
    palette: { base: '#E9EBEF', accent: '#3D5A99' }, sprite: 'fan',
  },
  {
    id: 'split-ac', name: 'Split AC, 1.5 HP', naira: 245_000, w: 2, h: 1,
    category: 'cooling', tags: ['luxe', 'cooling', 'tech', 'comfort'], placement: 'wallmount', priority: 6,
    palette: { base: '#F4F5F7', accent: '#9AA0AA' }, sprite: 'ac',
  },

  // Kitchen
  {
    id: 'cooler', name: 'Party-size food cooler', naira: 18_000, w: 1, h: 1,
    category: 'kitchen', tags: ['party', 'hosting', 'food', 'family'], placement: 'corner', priority: 4,
    palette: { base: '#2F5EA8', accent: '#F2F2F2' }, sprite: 'cooler',
  },
  {
    id: 'mini-fridge', name: 'Table-top fridge', naira: 160_000, w: 1, h: 1,
    category: 'kitchen', tags: ['luxe', 'comfort', 'food'], placement: 'corner', priority: 4,
    palette: { base: '#DCE0E6', accent: '#7D8593' }, sprite: 'fridge', tall: true,
  },

  // Decor
  {
    id: 'standing-mirror', name: 'Standing mirror', naira: 22_000, w: 1, h: 1,
    category: 'decor', tags: ['comfort', 'luxe', 'starter'], placement: 'wall', priority: 5,
    palette: { base: '#B8D3DD', accent: '#8A6440' }, sprite: 'mirror', tall: true, support: true,
  },
  {
    id: 'snake-plant', name: 'Snake plant in a pot', naira: 9_500, w: 1, h: 1,
    category: 'decor', tags: ['green', 'minimal', 'luxe'], placement: 'floor', priority: 3,
    palette: { base: '#2E7D5B', accent: '#B5523B' }, sprite: 'plant', maxQty: 2, support: true,
  },
  {
    id: 'areca-palm', name: 'Areca palm in a planter', naira: 14_000, w: 1, h: 1,
    category: 'decor', tags: ['green', 'luxe', 'comfort'], placement: 'floor', priority: 3,
    palette: { base: '#4F9A5E', accent: '#E3DCCB' }, sprite: 'plant', maxQty: 2, support: true,
  },
  {
    id: 'wall-clock', name: 'Wall clock', naira: 6_500, w: 1, h: 1,
    category: 'decor', tags: ['traditional', 'family', 'minimal'], placement: 'wallmount', priority: 3,
    palette: { base: '#F4F0E8', accent: '#141B3D' }, sprite: 'clock', support: true,
  },
  {
    id: 'photo-frames', name: 'Family photo frames', naira: 8_000, w: 2, h: 1,
    category: 'decor', tags: ['family', 'traditional'], placement: 'wallmount', priority: 3,
    palette: { base: '#8A5A34', accent: '#D7C7A8' }, sprite: 'frames', support: true,
  },
  {
    id: 'adire-print', name: 'Framed adire print', naira: 45_000, w: 2, h: 1,
    category: 'decor', tags: ['decor', 'luxe', 'minimal', 'traditional'], placement: 'wallmount', priority: 3,
    palette: { base: '#24346E', accent: '#EDE7DA' }, sprite: 'art', support: true,
  },
  {
    id: 'almanac', name: 'Parish almanac calendar', naira: 800, w: 1, h: 1,
    category: 'decor', tags: ['traditional', 'family', 'budget'], placement: 'wallmount', priority: 2,
    palette: { base: '#F4F0E8', accent: '#C2452D' }, sprite: 'calendar', support: true,
  },

  // Rugs
  {
    id: 'raffia-mat', name: 'Raffia mat', naira: 9_000, w: 4, h: 3,
    category: 'rug', tags: ['budget', 'traditional', 'starter'], placement: 'floor', priority: 4,
    palette: { base: '#D8B878', accent: '#B89350' }, sprite: 'mat', flat: true, hints: { centre: true }, support: true,
  },
  {
    id: 'bedside-rug', name: 'Bedside rug', naira: 12_000, w: 3, h: 2,
    category: 'rug', tags: ['comfort', 'starter', 'decor'], placement: 'floor', priority: 4,
    palette: { base: '#E4D2C0', accent: '#B5523B' }, sprite: 'mat', flat: true, support: true, hints: { near: 'sleep' },
  },
  {
    id: 'woven-rug', name: 'Woven rug', naira: 28_000, w: 5, h: 4,
    category: 'rug', tags: ['comfort', 'minimal', 'decor'], placement: 'floor', priority: 4,
    palette: { base: '#C7B9D8', accent: '#6F5E92' }, sprite: 'rug', flat: true, hints: { centre: true }, support: true,
  },
  {
    id: 'persian-rug', name: 'Persian-style rug', naira: 85_000, w: 6, h: 5,
    category: 'rug', tags: ['luxe', 'traditional', 'hosting'], placement: 'floor', priority: 4,
    palette: { base: '#9E3B32', accent: '#E3C27A', detail: '#24346E' }, sprite: 'rug', flat: true, hints: { centre: true }, support: true,
  },

  // Window
  {
    id: 'plain-curtains', name: 'Plain curtains', naira: 18_000, w: 3, h: 1,
    category: 'window', tags: ['minimal', 'budget', 'starter'], placement: 'wallmount', priority: 5,
    palette: { base: '#8FA7C9', accent: '#6E89B0' }, sprite: 'curtain', onWindow: true, support: true,
  },
  {
    id: 'lace-curtains', name: 'Lace curtains with pelmet', naira: 32_000, w: 3, h: 1,
    category: 'window', tags: ['traditional', 'family', 'party'], placement: 'wallmount', priority: 5,
    palette: { base: '#F2EBDD', accent: '#C9A15A' }, sprite: 'curtain', onWindow: true, support: true,
  },
  {
    id: 'roller-blinds', name: 'Roller blinds', naira: 26_000, w: 3, h: 1,
    category: 'window', tags: ['tech', 'minimal', 'luxe'], placement: 'wallmount', priority: 5,
    palette: { base: '#5C6475', accent: '#3E4555' }, sprite: 'blinds', onWindow: true, support: true,
  },
];

export const catalogueById: ReadonlyMap<string, CatalogueItem> = new Map(
  catalogue.map((item) => [item.id, item]),
);

export function getItem(id: string): CatalogueItem {
  const item = catalogueById.get(id);
  if (!item) throw new Error(`Unknown catalogue item: ${id}`);
  return item;
}
