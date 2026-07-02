import * as THREE from 'three';

// Placeholder ground plane. Prompt 4 replaces this with the room shell
// (floor + walls) generated from the `room` params in the state store.
export function createGround() {
  const geometry = new THREE.PlaneGeometry(10, 10);
  const material = new THREE.MeshStandardMaterial({
    color: 0xd8d4cd,
    roughness: 0.95,
    metalness: 0,
  });
  const ground = new THREE.Mesh(geometry, material);
  ground.name = 'ground';
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.userData = { itemId: 'room', surfaceRole: 'floor' };
  return ground;
}
