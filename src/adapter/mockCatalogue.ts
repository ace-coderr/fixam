import type { CatalogueItem, Category, Placement, RoomType } from './types';

/**
 * Seed data for the mock adapter, shaped exactly as getCatalogue() returns it.
 * Prices are BASE prices; the game multiplies them by the player's tier.
 *
 * verified: true items are confirmed against the live game, with their real
 * names, base prices and sizes. Fun, Skills, Light, Decor and Pets are
 * stand-ins until the live list is confirmed, and are all verified: false.
 */

// TODO: confirm floor finish prices with the live game; 3000 is a placeholder.
const FLOOR_FINISH_BASE_PRICE = 3_000;

const INDOOR: RoomType[] = ['parlour', 'bedroom', 'kitchen', 'bath', 'study', 'unassigned'];
const LIVING: RoomType[] = ['parlour', 'bedroom', 'study', 'unassigned'];
const SLEEPING: RoomType[] = ['bedroom', 'unassigned'];

interface Options {
  rotatable?: boolean;
}

function make(verified: boolean) {
  return (
    id: string,
    name: string,
    basePrice: number,
    [w, h]: [number, number],
    category: Category,
    placement: Placement,
    stars: number,
    tags: string[],
    roomTypes: RoomType[],
    options: Options = {},
  ): CatalogueItem => ({
    id,
    name,
    basePrice,
    w,
    h,
    category,
    placement,
    stars,
    tags,
    rotatable: options.rotatable ?? true,
    roomTypes,
    verified,
  });
}

const real = make(true);
const standIn = make(false);

export const mockCatalogue: CatalogueItem[] = [
  // Sleep
  real('foam-mattress', 'Foam Mattress', 1_800, [1, 2], 'Sleep', 'wall', 0, ['bed', 'budget', 'starter', 'minimal'], SLEEPING),
  real('spring-bed', 'Spring Bed', 7_800, [1, 2], 'Sleep', 'wall', 1, ['bed', 'comfort', 'starter', 'family'], SLEEPING),
  real('bunk-bed', 'Bunk Bed', 24_000, [1, 2], 'Sleep', 'wall', 1, ['bed', 'tall', 'family', 'budget'], SLEEPING),
  real('lekki-king-bed', 'Lekki King Bed', 28_800, [2, 2], 'Sleep', 'wall', 2, ['bed', 'luxe', 'comfort', 'bold'], SLEEPING),
  real('sliding-wardrobe', 'Sliding Wardrobe', 85_000, [2, 1], 'Sleep', 'wall', 2, ['storage', 'tall', 'minimal', 'family'], SLEEPING),
  real('upholstered-queen-bed', 'Upholstered Queen Bed', 95_000, [2, 2], 'Sleep', 'wall', 2, ['bed', 'comfort', 'soft', 'glam', 'luxe'], SLEEPING),
  real('four-poster-canopy-bed', 'Four-Poster Canopy Bed', 2_800_000, [2, 2], 'Sleep', 'wall', 3, ['bed', 'luxe', 'glam', 'traditional', 'soft'], SLEEPING),
  real('walk-in-closet-display', 'Walk-in Closet Display', 6_500_000, [2, 1], 'Sleep', 'wall', 3, ['storage', 'tall', 'luxe', 'glam'], SLEEPING),
  real('rotating-round-bed', 'Rotating Round Bed', 45_000_000, [2, 2], 'Sleep', 'floor', 4, ['bed', 'luxe', 'party', 'glam', 'bold'], SLEEPING),

  // Kitchen
  real('cooler-box', 'Cooler Box', 700, [1, 1], 'Kitchen', 'corner', 0, ['cold', 'food', 'party', 'hosting', 'budget'], ['kitchen', 'parlour', 'unassigned', 'yard']),
  real('kerosene-stove', 'Kerosene Stove', 1_100, [1, 1], 'Kitchen', 'wall', 0, ['cooking', 'food', 'budget', 'starter'], ['kitchen', 'unassigned']),
  real('kitchen-counter', 'Kitchen Counter', 4_200, [1, 1], 'Kitchen', 'wall', 1, ['counter', 'food', 'minimal'], ['kitchen', 'unassigned']),
  real('air-fryer', 'Air Fryer', 75_000, [1, 1], 'Kitchen', 'wall', 2, ['cooking', 'food', 'tech', 'comfort'], ['kitchen', 'unassigned']),
  real('chest-deep-freezer', 'Chest Deep Freezer', 165_000, [1, 1], 'Kitchen', 'wall', 2, ['cold', 'food', 'family', 'hosting'], ['kitchen', 'unassigned']),
  real('marble-kitchen-island', 'Marble Kitchen Island', 380_000, [1, 1], 'Kitchen', 'floor', 3, ['counter', 'luxe', 'glam', 'food', 'hosting'], ['kitchen']),
  real('five-burner-cooker-oven', '5-Burner Cooker & Oven', 420_000, [1, 1], 'Kitchen', 'wall', 3, ['cooking', 'luxe', 'food', 'family'], ['kitchen']),

  // Bath
  real('bucket-and-bowl', 'Bucket & Bowl', 400, [1, 1], 'Bath', 'corner', 0, ['wash', 'budget', 'starter'], ['bath', 'yard'], { rotatable: false }),
  real('water-drum-jerrycans', 'Water Drum & Jerrycans', 800, [1, 1], 'Bath', 'corner', 0, ['wash', 'budget', 'power', 'near-door'], ['bath', 'kitchen', 'yard']),
  real('wc-toilet', 'WC Toilet', 3_000, [1, 1], 'Bath', 'wall', 1, ['toilet', 'minimal'], ['bath']),
  real('rain-shower', 'Rain Shower', 11_400, [1, 1], 'Bath', 'corner', 1, ['wash', 'comfort', 'fresh'], ['bath']),
  real('bathtub', 'Bathtub', 19_200, [2, 1], 'Bath', 'wall', 2, ['wash', 'comfort', 'soft', 'luxe'], ['bath']),
  real('washing-machine', 'Washing Machine', 480_000, [1, 1], 'Bath', 'wall', 3, ['laundry', 'tech', 'family'], ['bath', 'kitchen']),
  real('jacuzzi', 'Jacuzzi', 25_000_000, [2, 2], 'Bath', 'floor', 4, ['wash', 'luxe', 'party', 'glam'], ['bath', 'yard']),

  // Comfort
  real('plastic-chair', 'Plastic Chair', 500, [1, 1], 'Comfort', 'floor', 0, ['seat', 'budget', 'party', 'hosting', 'starter'], ['parlour', 'bedroom', 'kitchen', 'study', 'yard', 'unassigned']),
  real('standing-fan', 'Standing Fan', 2_200, [1, 1], 'Comfort', 'corner', 0, ['cooling', 'budget', 'starter'], ['parlour', 'bedroom', 'kitchen', 'study', 'unassigned']),
  real('dining-table', 'Dining Table', 6_600, [2, 2], 'Comfort', 'floor', 1, ['table', 'family', 'hosting', 'food'], ['parlour', 'kitchen', 'unassigned']),
  real('lounge-armchair', 'Lounge Armchair', 8_500, [1, 1], 'Comfort', 'floor', 1, ['seat', 'comfort', 'natural', 'classic'], LIVING),
  real('velvet-sofa', 'Velvet Sofa', 10_200, [2, 1], 'Comfort', 'wall', 2, ['seat', 'comfort', 'luxe', 'soft', 'hosting'], ['parlour', 'unassigned']),
  real('bean-bag', 'Bean Bag', 12_000, [1, 1], 'Comfort', 'floor', 1, ['seat', 'comfort', 'soft', 'tech'], LIVING),

  // Design: wall paint
  ...([
    ['classic-cream', 'Classic Cream', 3_000, ['classic', 'warm', 'minimal', 'traditional']],
    ['lagos-sky', 'Lagos Sky', 3_000, ['cool', 'fresh', 'tech', 'minimal']],
    ['mint-fresh', 'Mint Fresh', 3_000, ['fresh', 'pastel', 'green', 'soft']],
    ['peach-glow', 'Peach Glow', 3_000, ['warm', 'soft', 'pastel', 'comfort']],
    ['soft-lilac', 'Soft Lilac', 3_000, ['soft', 'pastel', 'comfort', 'decor']],
    ['naija-green', 'Naija Green', 4_000, ['bold', 'green', 'traditional', 'party']],
    ['lekki-charcoal', 'Lekki Charcoal', 5_000, ['dark', 'bold', 'luxe', 'tech', 'minimal']],
    ['owambe-gold', 'Owambe Gold', 6_000, ['glam', 'luxe', 'party', 'bold']],
  ] as const).map(([id, name, price, tags]) =>
    real(`paint-${id}`, name, price, [0, 0], 'Design', 'wall', 1, ['paint', ...tags], INDOOR, { rotatable: false }),
  ),

  // Design: floors
  ...([
    ['terrazzo', 'Terrazzo', 1, ['classic', 'traditional', 'family', 'budget']],
    ['wood-parquet', 'Wood Parquet', 2, ['warm', 'natural', 'comfort', 'work']],
    ['white-marble', 'White Marble', 3, ['luxe', 'glam', 'minimal', 'fresh']],
    ['black-marble', 'Black Marble', 3, ['luxe', 'dark', 'bold']],
  ] as const).map(([id, name, stars, tags]) =>
    real(`floor-${id}`, name, FLOOR_FINISH_BASE_PRICE, [0, 0], 'Design', 'floor', stars, ['flooring', ...tags], INDOOR, { rotatable: false }),
  ),

  // Luxury. Yard vehicle sizes are not yet confirmed.
  real('diamond-studded-throne', 'Diamond-Studded Throne', 5_000_000, [1, 1], 'Luxury', 'floor', 4, ['seat', 'luxe', 'glam', 'bold', 'party'], ['parlour']),
  real('old-master-painting', 'Old Master Painting', 8_000_000, [2, 1], 'Luxury', 'wallmount', 4, ['decor', 'luxe', 'classic', 'traditional'], ['parlour', 'bedroom', 'study']),
  real('gold-bullion-vault', 'Gold Bullion Vault', 10_000_000, [1, 1], 'Luxury', 'corner', 4, ['luxury', 'luxe', 'bold', 'tall'], ['bedroom', 'study']),
  real('private-helicopter', 'Private Helicopter', 15_000_000, [3, 3], 'Luxury', 'yard', 4, ['vehicle', 'luxe', 'bold', 'tech'], ['yard']),
  real('light-jet', 'Light Jet', 24_000_000, [4, 3], 'Luxury', 'yard', 4, ['vehicle', 'luxe', 'bold', 'tech'], ['yard']),
  real('superyacht', 'Superyacht', 30_000_000, [4, 2], 'Luxury', 'yard', 4, ['vehicle', 'luxe', 'glam', 'party'], ['yard']),

  // Light (stand-ins)
  standIn('rechargeable-lantern', 'Rechargeable Lantern', 600, [1, 1], 'Light', 'floor', 0, ['light', 'budget', 'power', 'starter'], ['parlour', 'bedroom', 'kitchen', 'study', 'unassigned', 'yard']),
  standIn('bedside-lamp', 'Bedside Lamp', 2_500, [1, 1], 'Light', 'floor', 1, ['light', 'comfort', 'soft', 'warm'], ['bedroom', 'study', 'unassigned']),
  standIn('standing-floor-lamp', 'Standing Floor Lamp', 6_000, [1, 1], 'Light', 'corner', 1, ['light', 'minimal', 'natural', 'warm'], LIVING),
  standIn('led-strip-lights', 'LED Strip Lights', 3_500, [2, 1], 'Light', 'wallmount', 1, ['light', 'tech', 'party', 'bold', 'cool'], LIVING),
  standIn('brass-wall-sconce', 'Brass Wall Sconce', 9_000, [1, 1], 'Light', 'wallmount', 2, ['light', 'luxe', 'warm', 'glam', 'traditional'], ['parlour', 'bedroom']),
  standIn('waterproof-wall-light', 'Waterproof Wall Light', 1_800, [1, 1], 'Light', 'wallmount', 0, ['light', 'minimal'], ['bath', 'kitchen']),
  standIn('crystal-floor-lamp', 'Crystal Floor Lamp', 45_000, [1, 1], 'Light', 'corner', 3, ['light', 'luxe', 'glam'], ['parlour', 'bedroom']),
  standIn('solar-floodlight', 'Solar Floodlight', 7_000, [1, 1], 'Light', 'yard', 1, ['light', 'power', 'tech'], ['yard']),

  // Decor (stand-ins)
  standIn('raffia-mat', 'Raffia Mat', 1_200, [2, 2], 'Decor', 'floor', 0, ['rug', 'flat', 'budget', 'traditional', 'natural'], LIVING),
  standIn('shaggy-rug', 'Shaggy Rug', 6_000, [2, 2], 'Decor', 'floor', 1, ['rug', 'flat', 'soft', 'comfort', 'pastel'], ['parlour', 'bedroom', 'unassigned']),
  standIn('woven-rug', 'Woven Rug', 4_500, [3, 2], 'Decor', 'floor', 1, ['rug', 'flat', 'comfort', 'minimal', 'natural'], LIVING),
  standIn('owambe-carpet', 'Owambe Carpet', 12_000, [4, 3], 'Decor', 'floor', 1, ['rug', 'flat', 'party', 'hosting', 'bold', 'traditional'], ['parlour', 'unassigned']),
  standIn('persian-rug', 'Persian Rug', 18_000, [3, 3], 'Decor', 'floor', 2, ['rug', 'flat', 'luxe', 'traditional', 'warm'], ['parlour', 'bedroom', 'study']),
  standIn('bath-mat', 'Bath Mat', 500, [1, 1], 'Decor', 'floor', 0, ['rug', 'flat', 'budget', 'soft'], ['bath']),
  standIn('anti-slip-floor-mat', 'Anti-slip Floor Mat', 1_500, [2, 1], 'Decor', 'floor', 0, ['rug', 'flat', 'minimal'], ['bath', 'kitchen']),
  standIn('pebble-floor-mat', 'Pebble Floor Mat', 4_000, [2, 2], 'Decor', 'floor', 1, ['rug', 'flat', 'green', 'natural', 'fresh'], ['bath']),
  standIn('kitchen-runner-mat', 'Kitchen Runner Mat', 1_200, [2, 1], 'Decor', 'floor', 0, ['rug', 'flat', 'food', 'warm'], ['kitchen']),
  standIn('snake-plant', 'Snake Plant', 1_500, [1, 1], 'Decor', 'floor', 0, ['plant', 'green', 'minimal'], ['parlour', 'bedroom', 'study', 'kitchen', 'bath', 'unassigned']),
  standIn('areca-palm', 'Areca Palm', 3_500, [1, 1], 'Decor', 'floor', 1, ['plant', 'green', 'luxe', 'comfort'], LIVING),
  standIn('potted-fern', 'Potted Fern', 1_200, [1, 1], 'Decor', 'floor', 0, ['plant', 'green', 'fresh'], ['parlour', 'kitchen', 'bath']),
  standIn('wall-clock', 'Wall Clock', 800, [1, 1], 'Decor', 'wallmount', 0, ['decor', 'traditional', 'family', 'minimal'], ['parlour', 'bedroom', 'kitchen', 'study', 'unassigned']),
  standIn('photo-frames', 'Family Photo Frames', 1_000, [2, 1], 'Decor', 'wallmount', 0, ['decor', 'family', 'traditional', 'warm'], LIVING),
  standIn('adire-wall-hanging', 'Adire Wall Hanging', 5_000, [2, 1], 'Decor', 'wallmount', 1, ['decor', 'traditional', 'bold', 'natural'], LIVING),
  standIn('mirror-cabinet', 'Mirror Cabinet', 3_500, [1, 1], 'Decor', 'wallmount', 1, ['decor', 'minimal', 'fresh'], ['bath']),
  standIn('towel-rail', 'Towel Rail', 1_500, [1, 1], 'Decor', 'wallmount', 0, ['decor', 'comfort'], ['bath']),
  standIn('plain-curtains', 'Plain Curtains', 2_500, [2, 1], 'Decor', 'wallmount', 0, ['window', 'minimal', 'budget'], INDOOR),
  standIn('lace-curtains', 'Lace Curtains', 6_000, [2, 1], 'Decor', 'wallmount', 1, ['window', 'traditional', 'soft', 'family', 'party'], ['parlour', 'bedroom', 'unassigned']),
  standIn('roller-blinds', 'Roller Blinds', 4_000, [2, 1], 'Decor', 'wallmount', 1, ['window', 'tech', 'minimal', 'cool'], INDOOR),
  standIn('standing-mirror', 'Standing Mirror', 3_000, [1, 1], 'Decor', 'wall', 1, ['decor', 'tall', 'comfort', 'glam', 'soft'], SLEEPING),
  standIn('laundry-basket', 'Laundry Basket', 900, [1, 1], 'Decor', 'corner', 0, ['storage', 'budget'], ['bath', 'bedroom']),
  standIn('storage-basket', 'Woven Storage Basket', 1_500, [1, 1], 'Decor', 'corner', 0, ['storage', 'budget', 'natural', 'starter'], ['bedroom', 'study', 'unassigned']),
  standIn('mango-tree-planter', 'Mango Tree in a Planter', 5_000, [2, 2], 'Decor', 'yard', 1, ['plant', 'green', 'family', 'natural'], ['yard']),
  standIn('garden-bench', 'Garden Bench', 4_000, [2, 1], 'Decor', 'yard', 0, ['seat', 'natural', 'family', 'hosting'], ['yard']),
  standIn('flower-bed', 'Flower Bed', 2_000, [2, 1], 'Decor', 'yard', 0, ['plant', 'green', 'soft'], ['yard']),
  standIn('paved-patio', 'Paved Patio Tiles', 6_000, [3, 3], 'Decor', 'yard', 1, ['rug', 'flat', 'minimal'], ['yard']),
  standIn('canopy-tent', 'Owambe Canopy Tent', 15_000, [3, 3], 'Decor', 'yard', 1, ['fun', 'party', 'hosting'], ['yard']),

  // Fun (stand-ins)
  standIn('tv-stand', 'TV Stand with 43" TV', 45_000, [2, 1], 'Fun', 'wall', 2, ['screen', 'tech', 'family', 'hosting'], ['parlour', 'bedroom', 'unassigned']),
  standIn('game-console', 'Game Console Setup', 30_000, [1, 1], 'Fun', 'floor', 2, ['fun', 'tech', 'party'], LIVING),
  standIn('party-speaker', 'Party Speaker', 15_000, [1, 1], 'Fun', 'corner', 1, ['fun', 'party', 'hosting', 'bold'], ['parlour', 'yard', 'unassigned']),
  standIn('ludo-table', 'Ludo & Draughts Table', 4_000, [1, 1], 'Fun', 'floor', 0, ['fun', 'traditional', 'family', 'budget'], ['parlour', 'yard', 'unassigned']),
  standIn('pool-table', 'Pool Table', 120_000, [3, 2], 'Fun', 'floor', 3, ['fun', 'luxe', 'bold', 'hosting'], ['parlour']),
  standIn('home-cinema-screen', 'Home Cinema Screen', 350_000, [3, 1], 'Fun', 'wallmount', 4, ['screen', 'luxe', 'tech'], ['parlour']),
  standIn('ping-pong-table', 'Ping-Pong Table', 40_000, [3, 2], 'Fun', 'floor', 2, ['fun', 'family', 'hosting'], ['parlour', 'yard']),
  standIn('above-ground-pool', 'Above-Ground Pool', 60_000, [3, 3], 'Fun', 'yard', 2, ['fun', 'party', 'family'], ['yard']),
  standIn('swing-set', 'Swing Set', 20_000, [2, 2], 'Fun', 'yard', 1, ['fun', 'family'], ['yard']),
  standIn('steam-sauna', 'Steam Sauna', 250_000, [2, 2], 'Fun', 'corner', 4, ['fun', 'luxe', 'comfort'], ['bath']),
  standIn('massage-chair', 'Massage Chair', 85_000, [1, 1], 'Fun', 'floor', 3, ['seat', 'luxe', 'comfort', 'tech'], ['parlour', 'bedroom', 'bath']),

  // Skills (stand-ins)
  standIn('study-desk', 'Study Desk', 5_000, [2, 1], 'Skills', 'wall', 1, ['desk', 'study', 'work', 'starter', 'minimal'], ['study', 'bedroom', 'unassigned']),
  standIn('computer-workstation', 'Computer Workstation', 60_000, [2, 2], 'Skills', 'corner', 2, ['desk', 'tech', 'work'], ['study', 'bedroom']),
  standIn('bookshelf', 'Bookshelf', 7_000, [2, 1], 'Skills', 'wall', 1, ['storage', 'tall', 'study', 'natural'], LIVING),
  standIn('sewing-machine-table', 'Sewing Machine Table', 18_000, [1, 1], 'Skills', 'wall', 1, ['desk', 'work', 'traditional'], ['study', 'unassigned']),
  standIn('painting-easel', 'Painting Easel', 6_000, [1, 1], 'Skills', 'floor', 1, ['desk', 'decor', 'study'], ['study']),
  standIn('digital-piano', 'Digital Piano', 90_000, [2, 1], 'Skills', 'wall', 3, ['fun', 'luxe', 'study', 'classic'], ['parlour', 'study']),
  standIn('treadmill', 'Treadmill', 150_000, [1, 2], 'Skills', 'floor', 3, ['fun', 'tech', 'work'], ['parlour', 'bedroom', 'study']),
  standIn('weight-bench', 'Weight Bench', 25_000, [2, 1], 'Skills', 'floor', 1, ['fun', 'bold'], ['study', 'yard']),

  // Pets (stand-ins)
  standIn('dog-kennel', 'Dog Kennel', 8_000, [1, 1], 'Pets', 'yard', 1, ['pet', 'family', 'near-door'], ['yard']),
  standIn('cat-tree', 'Cat Tree', 6_000, [1, 1], 'Pets', 'corner', 1, ['pet', 'tall', 'soft'], ['parlour', 'bedroom']),
  standIn('chicken-coop', 'Chicken Coop', 12_000, [2, 2], 'Pets', 'yard', 1, ['pet', 'traditional', 'food'], ['yard']),
  standIn('aquarium', 'Aquarium', 30_000, [2, 1], 'Pets', 'wall', 2, ['pet', 'decor', 'luxe', 'cool'], ['parlour', 'study']),
  standIn('parrot-cage', 'Parrot Cage', 9_000, [1, 1], 'Pets', 'floor', 1, ['pet', 'party'], ['parlour']),
  standIn('pet-bed', 'Pet Bed', 2_500, [1, 1], 'Pets', 'floor', 0, ['pet', 'soft', 'comfort'], ['parlour', 'bedroom']),
];
