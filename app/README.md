# Thermiek centreren

A teaching game about thermal centering for paragliding pilots. Top-down view over real terrain (Werfenweng, Ahornach, Speikboden, Greifenburg), PWA-ready web app built with TypeScript, Vite and PixiJS.

```sh
npm install
npm run dev        # dev server, reachable on the LAN for phone testing
npm test           # simulation, level and i18n tests
npm run build      # typecheck + production build in dist/
npm run terrain    # regenerate public/terrain/* from elevation tiles (network needed); pass site ids to limit
```

## Structure

- `src/sim/` – flight model, thermals, terrain lookup; pure TypeScript, fixed timestep, no rendering dependencies
- `src/levels/` – flying sites (thermal trigger, start) and lessons (aids, complexity, goal); a flight is site × lesson × seed
- `src/render/` – PixiJS map, trail, lift overlay, markers
- `src/input/`, `src/audio/`, `src/ui/` – brake sliders/keyboard, vario sound, dialogs and settings
- `src/i18n/` – message catalogs; `nl.ts` defines the keys, add a locale in `index.ts`
- `scripts/build-terrain.ts` – builds height grid, shaded map and features for a site

## Adding a site

1. Add a `SiteConfig` in `scripts/build-terrain.ts` (origin, extent, takeoffs/landing/peaks from OpenStreetMap) and run `npm run terrain -- <id>`.
2. Add a `Site` in `src/levels/sites.ts` with a thermal trigger (a sun-facing spur below takeoff works well) and a start bearing over lower terrain.
3. `npm test` checks that every lesson starts clear of terrain and can reach its goal.

## Data

- Elevation: AWS Terrain Tiles (Mapzen), including data © Land Salzburg and Land Kärnten / data.gv.at (CC BY 4.0) and EU-DEM (Copernicus)
- Map features: © OpenStreetMap contributors (ODbL)
