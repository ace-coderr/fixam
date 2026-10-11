# Fixam

Fixam furnishes your home in **Lagos Life**, one room at a time. Open it from
your in-game phone, pick a room, say how you want it to feel and what you can
spend, and Fixam plans it: it picks pieces from the game's own shop, lays them
out, and hands you a receipt. Pay with in-game naira and the room is fixed.

This release ships one module, **Arrange**:

1. Describe a vibe ("soft life Lekki", "corper's self-con", "owambe-ready
   parlour", or your own words) and set a budget.
2. Fixam makes a plan: furniture that fits the vibe and the budget, placed on a
   floor plan of your room.
3. Check the plan and its receipt. Try another layout if you want the same
   pieces arranged differently. Nothing is charged yet.
4. Pay to fix it. The layout is saved to your flat and the receipt is stamped
   paid.

Pieces waiting in your storage go in first and show as ₦0, already yours.
Stored pieces that clash with the style are suggested for sale at the game's
60% resale value. If a piece won't fit the room, it's left off the bill.

When the game lets Fixam buy and place for you, it does the whole job, paying
the shop from your own wallet. Otherwise you get the plan as a step-by-step
list, in placing order, with the rotation for each piece. Either way Fixam
charges a service fee for the job and takes no margin on furniture.

## Running it

Fixam needs Node 18 or newer.

```bash
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173). The app is
built for a phone-sized frame: it centres itself at up to 440px wide, so a
narrow browser window or your browser's device toolbar shows it as players will
see it.

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Development server with hot reload            |
| `npm run build`     | Type-checks (strict) and builds into `dist/`  |
| `npm run preview`   | Serves the production build locally           |
| `npm run typecheck` | Type-checks without building                  |

The build uses relative asset paths, so `dist/` can be hosted at any path and
loaded into the game's iframe as-is. No server is needed, and nothing calls an
outside service: vibes are read offline.

## Connecting to the game

Fixam reaches the game only through one adapter, defined in
`src/adapter/types.ts`:

```ts
getPlayer(): Promise<Player>                 // includes netWorth and priceMultiplier
getWallet(): Promise<{ naira: number }>
charge(amount, reason): Promise<{ ok: boolean }>
getCatalogue(): Promise<CatalogueItem[]>     // everything on sale, live
getProperties(): Promise<Property[]>
getHouse(propertyId): Promise<House>         // { name, tier, rooms, yard }
getStorage(): Promise<StoredItem[]>          // bought but never placed
getCapabilities(): Promise<{ canBuy, canPlace }>
buyItems(itemIds): Promise<{ ok, stored }>
placeItems(roomId, layout, finishes): Promise<{ ok: boolean }>
```

Fixam has no catalogue of its own. Items arrive from `getCatalogue()` with base
prices, and every price shown or budgeted is the base price times the player's
`priceMultiplier` (×1 for starters, ×10 mid-tier, ×50 at the Big Man table).
The tier table lives in one place, `src/engine/pricing.ts`. Items the game adds
later work with no change: Fixam reads what an item is from its tags, falling
back to its category and name.

Development runs against `src/adapter/mock.ts`, an in-memory stand-in with
realistic response times. Its seed catalogue (`src/adapter/mockCatalogue.ts`)
uses confirmed game prices where they're known and marks the rest
`verified: false`. `createMockAdapter({ tier, capabilities })` gives a starter,
mid or Big Man player, in either execution mode. To go live, change the single
export in `src/adapter/index.ts` to an object that talks to the Lagos Life SDK.
No other file needs to change.

Houses are made of rooms with fixed walls. Each room is a grid, north at the
top, with its own doors and windows given as a wall plus an offset and width in
cells, and a type: parlour, bedroom, kitchen, bath, study, yard or unassigned.

## How Arrange decides

- **Reading the vibe** (`src/engine/vibes.ts`). Keyword rules turn free text into
  weights over style tags such as `luxe`, `budget`, `hosting` and `bold`. Six
  seeded vibes cover common Lagos rooms. The player's chosen leaning
  (masculine, feminine or neutral) shifts those weights; it never rules a
  category in or out. `readVibe` is the single entry point, so a different
  interpreter can be dropped in behind it.
- **Knowing the room** (`src/engine/traits.ts`). Only items meant for the room's
  type are considered, so there's never a toilet in the parlour. Each type has
  its own must-haves (a bed for a bedroom, a toilet and somewhere to wash for a
  bath) and its own coverage band: 45–60% of usable floor for parlours,
  bedrooms and studies, 35–50% for kitchens, 25–40% for baths and 10–25% for
  yards.
- **Choosing pieces** (`src/engine/select.ts`). Storage first, at ₦0. Then the
  must-haves, a floor and wall paint to match the vibe, nice-to-haves, and a
  density pass of rugs and small pieces until the room is in its band. Each pass
  keeps money aside so the floor can still be filled, and the total, with
  Fixam's fee, never exceeds the budget.
- **Placing them** (`src/engine/solver.ts`). A pure grid solver.
  `solve(items, room, seed)` returns a layout or a failure. Wall pieces back
  onto a wall and face into the room, corner pieces sit in corners, nothing
  stands in a doorway or overlaps anything else, tall pieces stay clear of
  windows, every door stays connected to the others and every piece can be
  reached on foot. Rotations come out as 0, 90, 180 or 270 degrees. The seed
  drives the search, so "Try another layout" gives a genuinely different
  arrangement that still follows every rule. `validateLayout` checks any layout
  against those rules.
- **Doing the job** (`src/engine/execute.ts`). Buys through the game's shop,
  places everything, applies the finishes, then charges the fee. If placing
  fails after buying, the retry only places; nothing is bought twice.

## Project layout

```
src/
  adapter/      game interface, mock game and its seed catalogue, active adapter
  engine/       pricing, room rules, vibe reading, selection, placement, execution (no React)
  components/   floor plan, item drawings, receipt
  modules/      one folder per module; registry.ts maps routes to modules
  shell/        game data provider and hash routing
  styles/       global styles and design tokens
```

## Adding a module

Fit, Frame, Houseboy and Owambe will sit alongside Arrange. To add one, create
`src/modules/<name>/` with a default-exported screen component and register it
in `src/modules/registry.ts` with its route (for example `/owambe`). The game
can open a module directly with a hash link such as `#/arrange`.
