import * as THREE from 'three';
import { DIMS } from '../state/schema.js';
import { box, boxGeom, mergeParts } from './util.js';
import { addBarHandle } from './fronts.js';

// Aluminium profile shutter: a slim metal frame around a full glass pane —
// the display/loft-shutter look. Signature-compatible with buildShakerPanel
// so it plugs into buildDoorFronts/lift builders as a panelBuilder.
const T = DIMS.frontThickness;
const FRAME_W = 0.021; // slim profile section

// Frame finish -> existing metal swatches (no new frame materials needed).
export const PROFILE_FRAME_MATERIALS = {
  silver: 'metal_steel',
  black: 'metal_black',
  gold: 'metal_brass',
};

export function buildProfilePanel({ w, h, frameMat, glassMat, handleStyle, handleMat, kind, hinge, tag }) {
  const g = new THREE.Group();
  const role = kind === 'drawer' ? 'drawerFront' : 'doorFront';

  const frameGeoms = [
    boxGeom(w, FRAME_W, T, w / 2, h - FRAME_W / 2, T / 2),
    boxGeom(w, FRAME_W, T, w / 2, FRAME_W / 2, T / 2),
    boxGeom(FRAME_W, h - 2 * FRAME_W, T, FRAME_W / 2, h / 2, T / 2),
    boxGeom(FRAME_W, h - 2 * FRAME_W, T, w - FRAME_W / 2, h / 2, T / 2),
  ];
  g.add(mergeParts(frameGeoms, frameMat, tag(role)));

  const pane = box(w - 2 * FRAME_W + 0.012, h - 2 * FRAME_W + 0.012, 0.005, glassMat, tag(role));
  pane.castShadow = false;
  pane.position.set(w / 2, h / 2, T / 2);
  g.add(pane);

  if (handleStyle === 'bar') {
    addBarHandle(g, { w, h, kind, hinge, material: handleMat, tag });
  } else if (handleStyle === 'jProfile') {
    const lip = box(w, 0.013, 0.012, handleMat, tag('handle'));
    lip.position.set(w / 2, h - 0.0065, 0.004);
    g.add(lip);
  }
  // Other handle styles read as handleless on profile shutters.
  return g;
}

// Binds the frame material so the result matches the panelBuilder signature.
export function makeProfilePanelBuilder(matLib, profile) {
  const frameMat = matLib.get(PROFILE_FRAME_MATERIALS[profile.frame ?? 'silver'] ?? 'metal_steel');
  return (opts) => buildProfilePanel({ ...opts, frameMat });
}
