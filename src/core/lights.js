import * as THREE from 'three';

// Studio rig: cool-sky/warm-ground hemisphere wash, one shadow-casting key
// from the upper left, one subtle shadowless fill. Two presets: 'day'
// (default) and 'evening' (lower hemisphere, warm key).
const PRESETS = {
  day: {
    hemi: { sky: 0xeef1f6, ground: 0xd8cbb8, intensity: 1.0 },
    key: { color: 0xfff6ea, intensity: 1.6 },
    fill: { color: 0xf2f0ea, intensity: 0.45 },
  },
  evening: {
    hemi: { sky: 0xd6dbe6, ground: 0xc9b090, intensity: 0.55 },
    key: { color: 0xffcf9a, intensity: 1.35 },
    fill: { color: 0xffe3c2, intensity: 0.35 },
  },
};

export function applyLightPreset(lights, name) {
  const preset = PRESETS[name] ?? PRESETS.day;
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
