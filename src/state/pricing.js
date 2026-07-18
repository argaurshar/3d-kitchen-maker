// Default rate card (INR). Everything the quote engine reads lives here so a
// company can re-rate the whole app from one place; scene.quote.rateOverrides
// overlays dot-path overrides (e.g. "unitRates.base": 2000) per design.
export const RATE_CARD = {
  // Cabinetry per running foot, by unit type (carcass + standard shutters).
  unitRates: { base: 1850, wall: 1450, tall: 2400, island: 2100 },
  // Flat adders per module for specialist internals.
  moduleAdders: { drawerBase: 1200, blindCorner: 900, filler: 200, dishwasher: 0 },
  // Shutter-system adders per door compartment.
  frontStyleAdders: { liftUp: 1500, biFold: 2600, profile: 3200, lit: 2800 },
  // Handle systems, flat per module.
  handleAdders: { jProfile: 700, none: 250 },
  // Finish multiplier keyed by the door swatch's CATEGORY.
  finishTiers: {
    paint: 1.0,
    laminate: 1.0,
    membrane: 1.15,
    wood: 1.25,
    veneer: 1.35,
    stone: 1.4,
    acrylic: 1.45,
    pu: 1.5,
    supermatt: 1.55,
    backglass: 1.6,
    metal: 1.3,
  },
  // Hardware/mechanism quality (hinges, channels, lift systems).
  hardwareTiers: { standard: 1.0, premium: 1.25, luxury: 1.5 },
  // Worktop features and standalone items, flat.
  features: { sink: 9500, hob: 14500, tap: 3500 },
  appliances: { fridge: 65000, hood: 18500 },
  furniture: { stool: 4500 },
  // Per-running-foot extras.
  extras: { worktopPerFt: 1400, backsplashPerFt: 950, underLightPerFt: 1200, islandFacesPerFt: 800 },
};

const lookup = (card, path) =>
  path.split('.').reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), card);

export function isValidRatePath(path) {
  return typeof lookup(RATE_CARD, path) === 'number';
}

// The card the quote engine actually uses: defaults + scene overrides.
export function resolveRateCard(scene) {
  const card = structuredClone(RATE_CARD);
  const overrides = scene?.quote?.rateOverrides ?? {};
  for (const [path, value] of Object.entries(overrides)) {
    if (!isValidRatePath(path) || typeof value !== 'number') continue;
    const keys = path.split('.');
    const leaf = keys.pop();
    lookup(card, keys.join('.'))[leaf] = value;
  }
  return card;
}
