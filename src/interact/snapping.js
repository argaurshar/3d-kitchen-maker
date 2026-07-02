import { DIMS } from '../state/schema.js';

const WALL_RANGE = 0.25;
const RUN_RANGE = 0.15;
const GRID = 0.05;

const rot2 = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
const runWidth = (item) => (item.modules ?? []).reduce((s, m) => s + m.width, 0);

// Rotate the run about its own center so wall snap doesn't swing it around
// its origin corner, then clamp the back plane flush to the wall.
function rotateAboutCenter(x, z, rotOld, rotNew, localCx, localCz) {
  const [ox, oz] = rot2(localCx, localCz, rotOld);
  const cx = x + ox;
  const cz = z + oz;
  const [nx, nz] = rot2(localCx, localCz, rotNew);
  return [cx - nx, cz - nz, cx, cz];
}

// Returns { position, rotationY, wallGuide } — pure, no store access.
export function snapPosition({ position, rotationY, item, room, otherItems, snapEnabled }) {
  let [x, z] = position;
  let rot = rotationY;
  let wallGuide = null;
  const rw = runWidth(item);
  const localC = [rw / 2, DIMS.baseDepth / 2];

  if (snapEnabled) {
    x = Math.round(x / GRID) * GRID;
    z = Math.round(z / GRID) * GRID;
  }

  // (b) wall snap: nearest wall whose back-plane distance is in range.
  const W2 = room.width / 2;
  const D2 = room.depth / 2;
  const walls = [
    { id: 'N', dist: Math.abs(z + D2), rot: 0, clamp: (p) => (p[1] = -D2) },
    { id: 'S', dist: Math.abs(z - D2), rot: Math.PI, clamp: (p) => (p[1] = D2) },
    { id: 'W', dist: Math.abs(x + W2), rot: Math.PI / 2, clamp: (p) => (p[0] = -W2) },
    { id: 'E', dist: Math.abs(x - W2), rot: -Math.PI / 2, clamp: (p) => (p[0] = W2) },
  ]
    .filter((w) => w.dist < WALL_RANGE)
    .sort((a, b) => a.dist - b.dist);
  if (walls.length) {
    const wall = walls[0];
    const [nx, nz] = rotateAboutCenter(x, z, rot, wall.rot, localC[0], localC[1]);
    const p = [nx, nz];
    wall.clamp(p);
    [x, z] = p;
    rot = wall.rot;
    wallGuide = wall.id;
  }

  // (c) run-to-run: snap my end flush to another same-type run's end.
  const sameAngle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.03;
  for (const other of otherItems) {
    if (other.id === item.id || other.kind !== 'run') continue;
    if ((other.unitType ?? 'base') !== (item.unitType ?? 'base')) continue;
    const orot = other.rotationY ?? 0;
    if (!sameAngle(rot, orot)) continue;
    const [dx, dz] = rot2(rw, 0, rot);
    const [odx, odz] = rot2(runWidth(other), 0, orot);
    const myEnds = [
      [x, z],
      [x + dx, z + dz],
    ];
    const theirEnds = [
      [other.position[0], other.position[1]],
      [other.position[0] + odx, other.position[1] + odz],
    ];
    // my origin to their far end
    if (Math.hypot(myEnds[0][0] - theirEnds[1][0], myEnds[0][1] - theirEnds[1][1]) < RUN_RANGE) {
      [x, z] = theirEnds[1];
      rot = orot;
      break;
    }
    // my far end to their origin
    if (Math.hypot(myEnds[1][0] - theirEnds[0][0], myEnds[1][1] - theirEnds[0][1]) < RUN_RANGE) {
      x = theirEnds[0][0] - dx;
      z = theirEnds[0][1] - dz;
      rot = orot;
      break;
    }
  }

  return { position: [x, z], rotationY: rot, wallGuide };
}
