// Standard dimensions in meters (see SPEC.md "Standard dimensions").
export const DIMS = {
  baseHeight: 0.72,
  plinthHeight: 0.12,
  baseDepth: 0.6, // nominal, including fronts
  carcassDepth: 0.56,
  frontThickness: 0.02,
  frontGap: 0.003,
  worktopThickness: 0.04,
  worktopOverhang: 0.02,
  panelThickness: 0.018,
  wallUnitDepth: 0.35,
  wallUnitHeight: 0.72,
  wallUnitMount: 1.45,
  tallHeight: 2.16,
  moduleWidthMin: 0.3,
  moduleWidthMax: 1.2,
  ovenHeight: 0.6,
  microwaveHeight: 0.38,
};

export const MODULE_TYPES = ['cabinet', 'drawerBase', 'blindCorner', 'dishwasher', 'filler'];
export const COMPARTMENT_TYPES = ['shelf', 'drawer', 'door', 'oven', 'microwave'];
export const HANDLE_STYLES = ['bar', 'hole', 'cutout'];
export const HINGES = ['L', 'R', 'double'];

// Defaults used by store actions when adding modules/compartments.
// Ids are assigned by the action layer.
export const MODULE_TEMPLATES = {
  cabinet: {
    type: 'cabinet',
    width: 0.6,
    handle: 'bar',
    compartments: [{ type: 'door', style: { hinge: 'L', glass: false }, shelvesInside: 1, weight: 1 }],
  },
  drawerBase: { type: 'drawerBase', width: 0.6, handle: 'bar', compartments: [] },
  dishwasher: { type: 'dishwasher', width: 0.6, handle: 'bar', compartments: [] },
  filler: { type: 'filler', width: 0.1, handle: 'bar', compartments: [] },
  blindCorner: {
    type: 'blindCorner',
    width: 0.9,
    handle: 'bar',
    compartments: [{ type: 'door', style: { hinge: 'R', glass: false }, shelvesInside: 1, weight: 1 }],
  },
};

export const COMPARTMENT_TEMPLATES = {
  shelf: { type: 'shelf', shelvesInside: 1, weight: 1 },
  drawer: { type: 'drawer', weight: 1 },
  door: { type: 'door', style: { hinge: 'L', glass: false }, shelvesInside: 1, weight: 1 },
  oven: { type: 'oven' },
  microwave: { type: 'microwave' },
};

// Width limits vary by module type (fillers are narrow strips).
export function moduleWidthRange(type) {
  return type === 'filler' ? [0.05, 0.3] : [DIMS.moduleWidthMin, DIMS.moduleWidthMax];
}
