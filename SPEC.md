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
- [ ] **P13 — Paint mode**: per-surface material painting via radial swatch
      wheel
- [ ] **P14 — Polish**: materials library breadth, persistence, final QA pass
