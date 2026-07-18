import * as THREE from 'three';
import { setEmissiveBoost } from '../materials/library.js';

// Studio rig: cool-sky/warm-ground hemisphere wash, one shadow-casting key
// from the upper left, one subtle shadowless fill. Presets: 'day',
// 'evening' (warm key), 'night' (ambient falls away so LED strips and
// backlit shutters carry the scene). Each preset also scales the emissive
// materials so the glow reads correctly without postprocessing bloom.
export const LIGHT_PRESETS = ['day', 'evening', 'night'];
const PRESETS = {
  day: {
    hemi: { sky: 0xeef1f6, ground: 0xd8cbb8, intensity: 1.0 },
    key: { color: 0xfff6ea, intensity: 1.6 },
    fill: { color: 0xf2f0ea, intensity: 0.45 },
    emissiveBoost: 0.6,
    envIntensity: 0.35,
  },
  evening: {
    hemi: { sky: 0xd6dbe6, ground: 0xc9b090, intensity: 0.55 },
    key: { color: 0xffcf9a, intensity: 1.35 },
    fill: { color: 0xffe3c2, intensity: 0.35 },
    emissiveBoost: 1.0,
    envIntensity: 0.26,
  },
  night: {
    hemi: { sky: 0x2e3644, ground: 0x3a3226, intensity: 0.22 },
    key: { color: 0xffd9a8, intensity: 0.38 },
    fill: { color: 0x9fb2cc, intensity: 0.1 },
    emissiveBoost: 1.8,
    envIntensity: 0.1,
  },
};

export function applyLightPreset(lights, name, scene = null) {
  const preset = PRESETS[name] ?? PRESETS.day;
  if (scene) scene.environmentIntensity = preset.envIntensity;
  const hemi = lights.getObjectByName('hemi');
  const key = lights.getObjectByName('key');
  const fill = lights.getObjectByName('fill');
  hemi.color.set(preset.hemi.sky);
  hemi.groundColor.set(preset.hemi.ground);
  hemi.intensity = preset.hemi.intensity;
  key.color.set(preset.key.color);
  key.intensity = preset.key.intensity;
  fill.color.set(preset.fill.color);
  fill.intensity = preset.fill.intensity;
  setEmissiveBoost(preset.emissiveBoost);
}

export function createLights() {
  const lights = new THREE.Group();
  lights.name = 'lights';

  const hemisphere = new THREE.HemisphereLight();
  hemisphere.name = 'hemi';
  lights.add(hemisphere);

  const key = new THREE.DirectionalLight();
  key.name = 'key';
  key.position.set(-5, 12, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -9;
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02;
  lights.add(key);
  lights.add(key.target);

  const fill = new THREE.DirectionalLight();
  fill.name = 'fill';
  fill.position.set(6, 5, -5);
  fill.castShadow = false;
  lights.add(fill);
  lights.add(fill.target);

  applyLightPreset(lights, 'day');
  return lights;
}
