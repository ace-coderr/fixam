# Fixam

Fixam furnishes your flat in **Lagos Life**. Open it from your in-game phone,
say how you want the room to feel and what you can spend, and Fixam plans the
room: it picks the pieces, lays them out, and hands you a receipt. Pay with
in-game naira and the room is fixed.

This release ships one module, **Arrange**:

1. Describe a vibe ("soft life Lekki", "corper's self-con", "owambe-ready
   parlour", or your own words) and set a budget.
2. Fixam makes a plan: furniture that fits the vibe and the budget, placed on a
   floor plan of your room.
3. Check the plan and its receipt. Try another layout if you want the same
   pieces arranged differently. Nothing is charged yet.
4. Pay to fix it. The layout is saved to your flat and the receipt is stamped
   paid.

Pieces you already own come free on the receipt. If a piece won't fit the room,
it's left off the bill.

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
getCurrentPlayer(): Promise<Player>          // { id, name, avatarTone }
getWallet(): Promise<{ naira: number }>
charge(amount, reason): Promise<{ ok: boolean }>
getRoom(): Promise<RoomSpec>                 // { widthCells, heightCells, door, window }
getOwnedItems(): Promise<string[]>           // catalogue ids
saveLayout(layout: PlacedItem[]): Promise<{ ok: boolean }>
```

Development runs against `src/adapter/mock.ts`, an in-memory stand-in with a
₦850,000 wallet and realistic response times. To go live, change the single
export in `src/adapter/index.ts` to an object that talks to the Lagos Life SDK.
No other file needs to change.

Rooms are grids of 50cm cells, north at the top. Doors and windows are given as
a wall plus an offset and width in cells.

## How Arrange decides

- **Reading the vibe** (`src/engine/vibes.ts`). Keyword rules turn free text into
  weights over tags such as `luxe`, `budget`, `hosting` and `power`. Six seeded
  vibes cover common Lagos rooms, and single words ("plants", "NEPA", "sapa")
  nudge individual tags. `readVibe` is the single entry point, so a different
  interpreter can be dropped in behind it.
- **Choosing pieces** (`src/engine/select.ts`). Bed, seating, light and storage
  come first, with money held back so each stays affordable. Nice-to-haves
  follow in order of vibe match × priority. A density pass then adds
  supporting pieces (rugs, stools, lamps, plants, wall decor) until furniture
  and rugs cover 45–60% of the usable floor, so a room looks furnished at any
  budget. Each pass keeps enough money aside for that floor to stay reachable,
  so one expensive piece can't leave the room half empty. The total never
  exceeds the budget.
- **Placing them** (`src/engine/solver.ts`). A pure grid solver.
  `solve(items, room, seed)` returns a layout or a failure. Wall pieces back
  onto a wall, corner pieces sit in corners, and nothing stands in the door's
  swing or overlaps anything else. Tall pieces stay clear of the window, and
  every piece can be reached on foot from the door. The seed drives the
  search, so "Try another layout" gives a genuinely different arrangement that
  still follows every rule. `validateLayout` checks any layout against those
  rules.

The catalogue lives in `src/data/catalogue.ts`. It has 56 pieces, from
a ₦800 parish almanac to a ₦250,000 king bed.

## Project layout

```
src/
  adapter/      game interface, mock, and the active adapter
  data/         furniture catalogue
  engine/       vibe reading, selection, placement (no React)
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
