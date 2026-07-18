# SPEC — Parametric 3D Kitchen Configurator

## Product

A web-based parametric kitchen configurator. Users place cabinet runs, tall
units, wall units, islands, appliances and stools in a room; every object is
generated from parameters, never from static models. A side panel edits the
selected object live — dimensions, modules, compartments, options — and the 3D
scene rebuilds instantly. A paint mode applies materials per surface (door
fronts, carcass, worktop, walls, floor, …) via a radial swatch wheel that opens
on the clicked surface.

## Data model

The entire scene is one JSON document held in the state store
(`src/state/store.js`). The 3D layer is a projection of this document.

```js
Scene = {
  room: { width: 6, depth: 5, wallHeight: 2.6, wallColor: "paint_white",
          floorMaterial: "tile_light" },
  items: []   // array of Item
}

Item (kind: "run") = {
  id, kind: "run",
  unitType: "base" | "wall" | "tall" | "island",
  position: [x, z], rotationY,
  worktop: true, plinth: true,
  materials: { door: "paint_sage", carcass: "paint_white",
               worktop: "wood_butcher", handle: "metal_black" },
  modules: [ Module ]
}

Module = {
  id, type: "cabinet" | "drawerBase" | "blindCorner" | "dishwasher" | "filler",
  width: 0.6,
  handle: "cutout" | "hole" | "bar",
  compartments: [ Compartment ]   // ordered top to bottom
}

Compartment = {
  id, type: "shelf" | "drawer" | "door" | "oven" | "microwave",
  style: { hinge: "L" | "R" | "double", glass: false },
  shelvesInside: 0,
  weight: 1        // proportional height share; ovens/microwaves have fixed heights instead
}

Item (kind: "appliance") = { id, kind: "appliance",
  applianceType: "fridge" | "sink" | "hob" | "tap" | "hood",
  position, rotationY, params: { ... per type, defined in Prompt 10 } }

Item (kind: "furniture") = { id, kind: "furniture",
  furnitureType: "stool", position, rotationY, params: { ... Prompt 11 } }
```

## Standard dimensions (meters)

| Quantity | Value |
| --- | --- |
| Base unit height | 0.72 |
| Plinth height | 0.12 |
| Base unit depth | 0.60 (carcass 0.56 + fronts 0.02 + gap) |
| Worktop thickness | 0.04 |
| Worktop front overhang | 0.02 |
| Wall unit depth | 0.35 |
| Wall unit height | 0.72 |
| Wall unit mounting height (from floor) | 1.45 |
| Tall unit height | 2.16 |
| Module width (allowed range) | 0.30 – 1.20 |
| Oven compartment height (fixed) | 0.60 |
| Microwave compartment height (fixed) | 0.38 |
| Gap between neighboring fronts | 0.003 |

## Feature checklist

Updated whenever a feature lands (see CLAUDE.md).

- [x] **P1 — Scaffold**: project structure, SPEC.md, CLAUDE.md, empty lit scene
      with orbit controls and ground plane
- [x] **P2 — Screenshot harness**: `tools/shot.mjs` renders deterministic views
      of the running app into `shots/` via Playwright
- [x] **P3 — State store**: JSON scene store with subscribe/notify, schema
      defaults, fixtures; 3D layer rebuilds only affected items
- [x] **P4 — Room shell**: floor and walls generated from `room` params, wall
      and floor materials
- [x] **P5 — Cabinet module generator**: carcass, doors, drawers, handles;
      compartments with proportional weights and fixed-height slots
- [x] **P6 — Run generator**: modules laid out in a row with fronts gap,
      worktop and plinth
- [x] **P7 — Unit types**: wall, tall and island runs with correct heights,
      depths and mounting
- [x] **P8 — Picking & selection**: raycast picking via `userData`, selection
      highlight
- [x] **P9 — Side panel**: live editing of the selected item's parameters,
      modules and compartments
- [x] **P10 — Appliances**: fridge, sink, hob, tap, hood generated from params
      *(hob/sink/tap are worktop features on `run.features`; fridge has the
      full type/finish/dimensions panel)*
- [x] **P11 — Furniture**: parametric stools
- [x] **P12 — Placement & snapping**: drag placement, rotation gizmo, snapping
      to walls and neighboring runs
- [x] **P13 — Paint mode**: per-surface material painting via radial swatch
      wheel
- [x] **P14 — Polish**: materials library breadth, persistence, final QA pass
- [x] **P15 — Elevations planner**: per-wall straight-on elevation views (N/E/S/W
      + Plan + 3D) with live element detection per wall and add-to-wall placement
      (`src/ui/elevations.js`, `src/state/elements.js`)
- [x] **P16 — Interaction audit**: `tools/button-audit.mjs` drives every button and
      control in the real DOM and asserts each produced its expected effect (52 checks)
- [x] **P22 — Quotation & proposal**: pure quote engine over the scene JSON
      (`src/state/quote.js` + `src/state/pricing.js` editable rate card with
      overrides in `scene.quote`) — per-unit line items by running-ft, finish-tier
      × hardware-tier multipliers, shutter-system adders, GST + discount; live
      re-pricing panel with rate editing from the toolbar ₹ button
      (`src/ui/quotePanel.js`); print-ready client proposal (cover, 3D hero, CAD
      sheet, per-wall spec, itemized quote) via `src/ui/proposal.js`; frozen-total
      regression guard in the smoke suite
- [x] **P21 — Materials & lighting**: 31 new finish swatches across laminate /
      acrylic / PU / membrane / veneer / super-matt / lacquered-glass families
      (`src/materials/swatchesFinishes.js`); paged material wheel (center disc
      cycles Classic | Finishes); under-cabinet LED strips on wall runs
      (`underLight`, emissive strip + warm point light, surfaceRole `ledStrip`);
      three-state lighting day / evening / night with per-preset emissive boost
      and environment-intensity scaling
- [x] **P20 — Shutter systems**: per-door front styles hinged / top-hung lift-up /
      bi-fold (applyOpenAmount contract extended; `src/build/frontsLift.js`),
      aluminium glass-profile shutters with silver/black/gold frames and
      clear/frosted/fluted glass (`src/build/frontsProfile.js`), backlit LED panes
      (`glass_led` emissive swatch), handleless None / J-Profile handle styles,
      island shutter faces on back + both ends (`src/build/islandFaces.js`,
      `islandFaces:'shutter'`), 2D drawing symbols for all of the above
- [x] **P19 — Ergonomics**: on-selection quick actions (rotate 90° / duplicate /
      materials / delete, `src/ui/quickActions.js`); double-click any surface opens
      the material wheel without a mode switch; categorized catalog with Presets tab
      replaces the furnish row (`src/ui/catalog.js`); help & shortcuts overlay on "?"
      (`src/ui/helpOverlay.js`)
- [x] **P18 — Foundations**: actions split under `src/state/actions/` (barrel kept);
      undo/redo (`src/state/history.js`, Ctrl+Z/Y, gesture-coalescing snapshots);
      display units mm/ft-in (`src/state/units.js`); room width/depth/height editing
      via the Build button (`src/ui/roomPanel.js`); arrow-key nudge + rotateItem +
      duplicateItem (`src/ui/shortcuts.js`)
- [x] **P17 — Suggestions & drawings**: missing-element detection with one-click add
      (`suggestMissing` in `src/state/elements.js`) and a drawing-sheet export where
      the plan and all four elevations are true 2D CAD line drawings generated from
      the scene JSON (`src/draw2d/`: plan, elevation, fronts2d, svg) — wall cuts,
      door swings, glazing marks, appliance symbols, backsplash hatch, scale bar,
      north arrow, per-module cm chains, run/wall/height dims — exported as PNG
      (rasterized) or vector SVG for print (`src/core/drawings.js` composer)
