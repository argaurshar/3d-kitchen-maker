import * as THREE from 'three';

// Shared mesh factories for generators. Every mesh is tagged via userData
// (itemId, moduleId?, compartmentId?, surfaceRole) per CLAUDE.md.

export function box(width, height, depth, material, userData) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = userData;
  return mesh;
}

export function cylinder(radius, length, material, userData, radialSegments = 20) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, radialSegments),
    material
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = userData;
  return mesh;
}

// BoxGeometry UVs span 0..1 per face; rescale them to world meters so
// textures with userData.worldSize keep a constant real-world scale on any
// box size. Face order: +x, -x, +y, -y, +z, -z (4 verts each).
export function worldScaleBoxUVs(geometry, width, height, depth) {
  const dims = [
    [depth, height],
    [depth, height],
    [width, depth],
    [width, depth],
    [width, height],
    [width, height],
  ];
  const uv = geometry.attributes.uv;
  for (let face = 0; face < 6; face += 1) {
    for (let vert = 0; vert < 4; vert += 1) {
      const i = face * 4 + vert;
      uv.setXY(i, uv.getX(i) * dims[face][0], uv.getY(i) * dims[face][1]);
    }
  }
  uv.needsUpdate = true;
}
