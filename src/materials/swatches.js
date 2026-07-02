import { makeWoodTexture, makeBrushedTexture } from './textures.js';

// Swatch registry: (id, label, category, params). The MaterialLibrary in
// library.js turns params into cached MeshStandardMaterials; `map` is a
// factory called lazily so canvases are only built when a material is used.
export const SWATCHES = [
  {
    id: 'paint_white',
    label: 'Chalk White',
    category: 'paint',
    params: { color: '#f2efe9', roughness: 0.6, metalness: 0 },
  },
  {
    id: 'paint_sage',
    label: 'Sage',
    category: 'paint',
    params: { color: '#96a487', roughness: 0.55, metalness: 0 },
  },
  {
    id: 'paint_charcoal',
    label: 'Charcoal',
    category: 'paint',
    params: { color: '#3f4245', roughness: 0.5, metalness: 0 },
  },
  {
    id: 'wood_butcher',
    label: 'Butcher Block',
    category: 'wood',
    params: { color: '#ffffff', roughness: 0.55, metalness: 0, map: makeWoodTexture },
  },
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
    id: 'glass_tint',
    label: 'Tinted Glass',
    category: 'glass',
    params: {
      color: '#b9c7bf',
      roughness: 0.12,
      metalness: 0,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    },
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
    category: 'metal',
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
