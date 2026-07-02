import * as THREE from 'three';
import { makeTileTexture } from '../materials/textures.js';

const WALL_THICKNESS = 0.1;
const STUDIO_SIZE = 40;
const GRID_EXTENT = 12;
const GRID_STEP = 1;

// Y offsets keep the coplanar studio layers from z-fighting. Items are
// placed on the room floor plane by the projection layer.
export const FLOOR_TOP_Y = 0.02;
const Y_SHADOW_CATCHER = 0.005;
const Y_GRID = 0.01;
const Y_ROOM_FLOOR = FLOOR_TOP_Y;

// Pure generator: (roomParams) => THREE.Group (see CLAUDE.md).
// Builds the room shell plus the "studio" surroundings: a background-neutral
// floor, a shadow catcher, and a faint grid outside the room footprint.
export function buildRoom(room) {
  const { width, depth, wallHeight } = room;
  const group = new THREE.Group();
  group.name = 'room';

  group.add(buildStudioFloor());
  group.add(buildShadowCatcher());
  group.add(buildStudioGrid(width, depth));
  group.add(buildRoomFloor(width, depth));
  for (const wall of buildWalls(width, depth, wallHeight)) group.add(wall);
  return group;
}

// Hide any wall whose outward normal faces the camera so the camera always
// sees INTO the room. Called every frame.
const _toCamera = new THREE.Vector3();
const _wallPos = new THREE.Vector3();
export function updateWallVisibility(roomGroup, camera) {
  for (const child of roomGroup.children) {
    const normal = child.userData.outwardNormal;
    if (!normal) continue;
    child.getWorldPosition(_wallPos);
    _toCamera.copy(camera.position).sub(_wallPos).normalize();
    child.visible = _toCamera.dot(normal) <= 0.1;
  }
}

// Matches the page background so the scene reads as a maquette on an
// endless white studio floor. Unlit: tone mapping shifts it exactly like
// scene.background, so the seam is invisible.
function buildStudioFloor() {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(STUDIO_SIZE, STUDIO_SIZE),
    new THREE.MeshBasicMaterial({ color: 0xececec })
  );
  mesh.name = 'studioFloor';
  mesh.rotation.x = -Math.PI / 2;
  mesh.userData = { itemId: 'studio', surfaceRole: 'floor' };
  return mesh;
}

// Unlit floors can't receive shadows, so a transparent ShadowMaterial layer
// catches the room's soft drop shadow.
function buildShadowCatcher() {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(STUDIO_SIZE, STUDIO_SIZE),
    new THREE.ShadowMaterial({ opacity: 0.13 })
  );
  mesh.name = 'studioShadowCatcher';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = Y_SHADOW_CATCHER;
  mesh.receiveShadow = true;
  mesh.userData = { itemId: 'studio', surfaceRole: 'floor' };
  return mesh;
}

// Faint line grid OUTSIDE the room footprint only; inside, tiles only.
function buildStudioGrid(width, depth) {
  const holeX = width / 2 + WALL_THICKNESS + 0.02;
  const holeZ = depth / 2 + WALL_THICKNESS + 0.02;
  const E = GRID_EXTENT;
  const points = [];

  const addLine = (alongZ, at, holeAcross, holeAlong) => {
    const inHole = Math.abs(at) <= holeAcross;
    const spans = inHole
      ? [
          [-E, -holeAlong],
          [holeAlong, E],
        ]
      : [[-E, E]];
    for (const [from, to] of spans) {
      if (from >= to) continue;
      if (alongZ) points.push(at, 0, from, at, 0, to);
      else points.push(from, 0, at, to, 0, at);
    }
  };

  for (let i = -E; i <= E; i += GRID_STEP) {
    addLine(true, i, holeX, holeZ);
    addLine(false, i, holeZ, holeX);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const grid = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xd9d9d9 })
  );
  grid.name = 'studioGrid';
  grid.position.y = Y_GRID;
  grid.raycast = () => {}; // never intercept picking rays
  return grid;
}

function buildRoomFloor(width, depth) {
  const texture = makeTileTexture();
  texture.repeat.set(
    width / texture.userData.worldSize,
    depth / texture.userData.worldSize
  );
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.92,
      metalness: 0,
    })
  );
  mesh.name = 'roomFloor';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = Y_ROOM_FLOOR;
  mesh.receiveShadow = true;
  mesh.userData = { itemId: 'room', surfaceRole: 'floor' };
  return mesh;
}

function buildWalls(width, depth, height) {
  const t = WALL_THICKNESS;
  const material = new THREE.MeshStandardMaterial({
    color: 0xf4f1ec,
    roughness: 0.95,
    metalness: 0,
  });
  const walls = [
    { name: 'wall-north', size: [width + 2 * t, height, t], pos: [0, height / 2, -(depth + t) / 2], normal: [0, 0, -1] },
    { name: 'wall-south', size: [width + 2 * t, height, t], pos: [0, height / 2, (depth + t) / 2], normal: [0, 0, 1] },
    { name: 'wall-west', size: [t, height, depth], pos: [-(width + t) / 2, height / 2, 0], normal: [-1, 0, 0] },
    { name: 'wall-east', size: [t, height, depth], pos: [(width + t) / 2, height / 2, 0], normal: [1, 0, 0] },
  ];
  return walls.map(({ name, size, pos, normal }) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { itemId: 'room', surfaceRole: 'wall' };
    mesh.userData.outwardNormal = new THREE.Vector3(...normal);
    return mesh;
  });
}
