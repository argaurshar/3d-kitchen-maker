import * as THREE from 'three';
import { SWATCHES } from './swatches.js';

// Lazily creates and caches one shared MeshStandardMaterial per material id.
// Shared materials are marked userData.shared so disposeGroup never disposes
// them (see CLAUDE.md "Dispose on rebuild").
export class MaterialLibrary {
  constructor(swatches = SWATCHES) {
    this.swatches = new Map(swatches.map((swatch) => [swatch.id, swatch]));
    this.cache = new Map();
  }

  get(id) {
    const cached = this.cache.get(id);
    if (cached) return cached;

    const swatch = this.swatches.get(id);
    let material;
    if (swatch) {
      const { map, roughnessMap, ...params } = swatch.params;
      material = new THREE.MeshStandardMaterial(params);
      if (map) material.map = map();
      if (roughnessMap) material.roughnessMap = roughnessMap();
    } else {
      console.warn(`MaterialLibrary: unknown material id "${id}"`);
      material = new THREE.MeshStandardMaterial({ color: 0xff00ff });
    }
    material.name = id;
    material.userData.shared = true;
    if (swatch?.params.emissiveIntensity != null) {
      material.userData.baseEmissive = swatch.params.emissiveIntensity;
      material.emissiveIntensity = swatch.params.emissiveIntensity * emissiveBoost;
    }
    this.cache.set(id, material);
    return material;
  }
}

export const materialLibrary = new MaterialLibrary();

// Light presets scale every emissive material (LED strips, backlit panes)
// so glow reads stronger as the ambient light drops — a cheap stand-in for
// bloom. Shared-material mutation: zero rebuilds.
let emissiveBoost = 1;
export function setEmissiveBoost(factor) {
  emissiveBoost = factor;
  for (const material of materialLibrary.cache.values()) {
    const base = material.userData.baseEmissive;
    if (base != null) material.emissiveIntensity = base * factor;
  }
}
