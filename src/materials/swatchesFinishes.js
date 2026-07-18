import { makeWoodTexture } from './textures.js';

// Indian-market shutter finish families (the #1 sales conversation):
// laminate, acrylic, PU paint, membrane, veneer, super-matt, back-painted
// glass. Same procedural approach as the core swatches — flat params plus
// the existing wood-grain maker for woodgrain laminates and veneers.
const lam = (id, label, color, roughness = 0.5) => ({
  id,
  label,
  category: 'laminate',
  params: { color, roughness, metalness: 0 },
});
const lamWood = (id, label, baseColor, seed) => ({
  id,
  label,
  category: 'laminate',
  params: { color: '#ffffff', roughness: 0.55, metalness: 0, map: () => makeWoodTexture({ baseColor, seed }) },
});
const acr = (id, label, color) => ({
  id,
  label,
  category: 'acrylic',
  params: { color, roughness: 0.07, metalness: 0.04 },
});
const pu = (id, label, color, gloss) => ({
  id,
  label,
  category: 'pu',
  params: { color, roughness: gloss ? 0.12 : 0.5, metalness: 0 },
});
const mem = (id, label, color) => ({
  id,
  label,
  category: 'membrane',
  params: { color, roughness: 0.45, metalness: 0 },
});
const ven = (id, label, baseColor, seed) => ({
  id,
  label,
  category: 'veneer',
  params: { color: '#ffffff', roughness: 0.38, metalness: 0.02, map: () => makeWoodTexture({ baseColor, seed }) },
});
// baseColor for wood maps is { h, s, l } (see textures.makeWoodTexture).
const smt = (id, label, color) => ({
  id,
  label,
  category: 'supermatt',
  params: { color, roughness: 0.96, metalness: 0 },
});
const bpg = (id, label, color) => ({
  id,
  label,
  category: 'backglass',
  params: { color, roughness: 0.05, metalness: 0.12 },
});

export const FINISH_SWATCHES = [
  // Laminates: matt, high-gloss, woodgrain texture.
  lam('lam_matt_white', 'Laminate Frost', '#f2f1ed', 0.55),
  lam('lam_matt_grey', 'Laminate Ash Grey', '#b9bcbd', 0.55),
  lam('lam_matt_slate', 'Laminate Slate', '#5d6468', 0.55),
  lam('lam_matt_sand', 'Laminate Sand', '#d8c9ae', 0.55),
  lam('lam_gloss_white', 'Gloss Laminate White', '#f7f6f2', 0.16),
  lam('lam_gloss_red', 'Gloss Laminate Ruby', '#9d2f35', 0.16),
  lam('lam_gloss_teal', 'Gloss Laminate Teal', '#2f6f72', 0.16),
  lamWood('lam_wood_teak', 'Laminate Teak', { h: 28, s: 42, l: 44 }, 61),
  lamWood('lam_wood_wenge', 'Laminate Wenge', { h: 22, s: 28, l: 24 }, 62),
  // Acrylic high gloss.
  acr('acr_white', 'Acrylic Arctic', '#f8f7f4'),
  acr('acr_cream', 'Acrylic Cream', '#efe6d4'),
  acr('acr_grey', 'Acrylic Storm', '#8e969c'),
  acr('acr_navy', 'Acrylic Navy', '#2b3a55'),
  // PU paint.
  pu('pu_matt_ivory', 'PU Matt Ivory', '#efe9dc', false),
  pu('pu_matt_olive', 'PU Matt Olive', '#7a7f5e', false),
  pu('pu_gloss_white', 'PU Gloss Pearl', '#f6f5f1', true),
  pu('pu_gloss_wine', 'PU Gloss Wine', '#6c2e3e', true),
  // Membrane / thermofoil.
  mem('mem_white', 'Membrane Classic', '#f0eee8'),
  mem('mem_cashmere', 'Membrane Cashmere', '#d9cfc0'),
  mem('mem_sage', 'Membrane Sage', '#a8b39a'),
  // Natural veneer.
  ven('ven_oak', 'Oak Veneer', { h: 35, s: 44, l: 55 }, 71),
  ven('ven_walnut', 'Walnut Veneer', { h: 26, s: 36, l: 32 }, 72),
  ven('ven_smoked', 'Smoked Veneer', { h: 30, s: 18, l: 28 }, 73),
  // Super-matt (anti-fingerprint).
  smt('smt_white', 'Super-Matt Chalk', '#eceae5'),
  smt('smt_graphite', 'Super-Matt Graphite', '#3f4348'),
  smt('smt_forest', 'Super-Matt Forest', '#42544a'),
  // Back-painted (lacquered) glass.
  bpg('bpg_white', 'Lacquered Glass Ice', '#eef1f2'),
  bpg('bpg_black', 'Lacquered Glass Noir', '#23272b'),
  bpg('bpg_ochre', 'Lacquered Glass Ochre', '#c98f3f'),
];
