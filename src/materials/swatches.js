import { makeWoodTexture } from './textures.js';

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
];
