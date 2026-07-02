import { makeWoodTexture, makeBrushedTexture, makeTileTexture } from './textures.js';
import {
  makeMarbleTexture,
  makeGraniteTexture,
  makeConcreteTexture,
  makeTerrazzoTexture,
  makeQuartzTexture,
  makeParquetTexture,
} from './stoneTextures.js';

// Swatch registry: (id, label, category, params). The MaterialLibrary turns
// params into cached MeshStandardMaterials; `map`/`roughnessMap` are lazy
// factories. The paint wheel renders previews from the same color/canvas.

const paint = (id, label, color, roughness = 0.55) => ({
  id,
  label,
  category: 'paint',
  params: { color, roughness, metalness: 0 },
});
const wood = (id, label, baseColor, seed, roughness = 0.55) => ({
  id,
  label,
  category: 'wood',
  params: { color: '#ffffff', roughness, metalness: 0, map: () => makeWoodTexture({ baseColor, seed }) },
});
const stone = (id, label, map, roughness = 0.35) => ({
  id,
  label,
  category: 'stone',
  params: { color: '#ffffff', roughness, metalness: 0.02, map },
});

export const SWATCHES = [
  // ---- PAINT (12) ----
  paint('paint_white', 'Chalk White', '#f2efe9', 0.6),
  paint('paint_cotton', 'Cotton', '#f7f5f0', 0.62),
  paint('paint_cream', 'Cream', '#eee3cd'),
  paint('paint_sage', 'Sage', '#96a487'),
  paint('paint_olive', 'Olive', '#6f7355'),
  paint('paint_teal', 'Teal', '#3e6b6b'),
  paint('paint_navy', 'Navy', '#2e4058'),
  paint('paint_clay', 'Clay', '#b0664a'),
  paint('paint_mustard', 'Mustard', '#c9a24a'),
  paint('paint_rose', 'Dusty Rose', '#c69a94'),
  paint('paint_charcoal', 'Charcoal', '#3f4245', 0.5),
  paint('paint_black', 'Ink Black', '#23252a', 0.48),

  // ---- WOOD (8) ----
  {
    id: 'wood_butcher',
    label: 'Butcher Block',
    category: 'wood',
    params: { color: '#ffffff', roughness: 0.55, metalness: 0, map: makeWoodTexture },
  },
  wood('wood_oak', 'Oak', { h: 38, s: 34, l: 64 }, 22),
  wood('wood_ash', 'Ash', { h: 40, s: 14, l: 74 }, 23),
  wood('wood_pine', 'Pine', { h: 42, s: 48, l: 70 }, 24),
  wood('wood_walnut', 'Walnut', { h: 26, s: 32, l: 36 }, 25),
  wood('wood_rosewood', 'Rosewood', { h: 12, s: 40, l: 32 }, 26),
  wood('wood_wenge', 'Wenge', { h: 24, s: 22, l: 20 }, 27),
  {
    id: 'wood_parquet',
    label: 'Parquet',
    category: 'wood',
    params: { color: '#ffffff', roughness: 0.5, metalness: 0, map: () => makeParquetTexture() },
  },

  // ---- STONE (6, incl. the default floor tile) ----
  stone('stone_quartz', 'Grey Quartz', () => makeQuartzTexture(), 0.4),
  stone('stone_marble', 'White Marble', () => makeMarbleTexture(), 0.22),
  stone('stone_granite', 'Black Granite', () => makeGraniteTexture(), 0.3),
  stone('stone_concrete', 'Concrete', () => makeConcreteTexture(), 0.7),
  stone('stone_terrazzo', 'Terrazzo', () => makeTerrazzoTexture(), 0.35),
  stone('tile_light', 'Light Tile', () => makeTileTexture(), 0.85),

  // ---- METAL (3) ----
  {
    id: 'metal_black',
    label: 'Matte Black',
    category: 'metal',
    params: { color: '#2a2c2e', metalness: 0.7, roughness: 0.45 },
  },
  {
    id: 'metal_steel',
    label: 'Steel',
    category: 'metal',
    params: { color: '#c8ccd0', metalness: 0.9, roughness: 0.35 },
  },
  {
    id: 'metal_brass',
    label: 'Brass',
    category: 'metal',
    params: { color: '#c9a45f', metalness: 0.92, roughness: 0.3 },
  },

  // ---- Glass + appliance finishes (not in the wheel's core rings) ----
  {
    id: 'glass_tint',
    label: 'Tinted Glass',
    category: 'glass',
    params: { color: '#b9c7bf', roughness: 0.12, metalness: 0, transparent: true, opacity: 0.25, depthWrite: false },
  },
  {
    id: 'glass_dark',
    label: 'Appliance Glass',
    category: 'glass',
    params: { color: '#15181b', roughness: 0.15, metalness: 0.6 },
  },
  {
    id: 'appliance_dark',
    label: 'Appliance Body',
    category: 'appliance',
    params: { color: '#2c2f33', roughness: 0.4, metalness: 0.5 },
  },
  {
    id: 'appliance_white',
    label: 'Appliance White',
    category: 'appliance',
    params: { color: '#f0efec', roughness: 0.45, metalness: 0.08 },
  },
  {
    id: 'steel_stainless',
    label: 'Stainless',
    category: 'appliance',
    params: { color: '#c6cacd', roughness: 0.35, metalness: 0.85, roughnessMap: () => makeBrushedTexture({ strength: 0.35 }) },
  },
  {
    id: 'steel_brushed',
    label: 'Brushed Steel',
    category: 'appliance',
    params: { color: '#b4b8bc', roughness: 0.45, metalness: 0.85, roughnessMap: () => makeBrushedTexture({ strength: 0.7, seed: 41 }) },
  },
  {
    id: 'steel_black',
    label: 'Black Steel',
    category: 'appliance',
    params: { color: '#2b2e33', roughness: 0.4, metalness: 0.8, roughnessMap: () => makeBrushedTexture({ strength: 0.4, seed: 42 }) },
  },
  {
    id: 'brass_brushed',
    label: 'Brushed Brass',
    category: 'appliance',
    params: { color: '#c9a468', roughness: 0.42, metalness: 0.9, roughnessMap: () => makeBrushedTexture({ strength: 0.6, seed: 43 }) },
  },
  {
    id: 'champagne',
    label: 'Champagne',
    category: 'appliance',
    params: { color: '#d8c4a8', roughness: 0.38, metalness: 0.85, roughnessMap: () => makeBrushedTexture({ strength: 0.4, seed: 44 }) },
  },
];
