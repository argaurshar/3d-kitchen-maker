import * as THREE from 'three';

// Studio three-point-ish rig: cool-sky/warm-ground hemisphere wash, one
// shadow-casting key from the upper left, one subtle shadowless fill.
export function createLights() {
  const lights = new THREE.Group();
  lights.name = 'lights';

  const hemisphere = new THREE.HemisphereLight(0xeef1f6, 0xd8cbb8, 1.0);
  lights.add(hemisphere);

  const key = new THREE.DirectionalLight(0xfff6ea, 1.6);
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

  const fill = new THREE.DirectionalLight(0xf2f0ea, 0.45);
  fill.position.set(6, 5, -5);
  fill.castShadow = false;
  lights.add(fill);
  lights.add(fill.target);

  return lights;
}
