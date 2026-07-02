import * as THREE from 'three';

export function createLights() {
  const lights = new THREE.Group();
  lights.name = 'lights';

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0xb8b4ae, 1.0);
  lights.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(6, 8, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 30;
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.bias = -0.0005;
  lights.add(sun);
  lights.add(sun.target);

  return lights;
}
