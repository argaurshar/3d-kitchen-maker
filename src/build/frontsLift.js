import * as THREE from 'three';
import { buildShakerPanel } from './fronts.js';

// Overhead shutter mechanics: top-hung lift-up (one flap pivoting at its
// top edge, Aventos-HK style) and bi-fold lift-up (two horizontal leaves
// folding as they rise, Aventos-HF style). Both honor the applyOpenAmount
// contract via userData.openable; the panel look (shaker or profile glass)
// comes in through panelBuilder.

export function buildLiftUpFront({ rect, zBack, doorMat, glassMat, handleStyle, handleMat, tag, panelBuilder = buildShakerPanel }) {
  const { x0, x1, y0, y1 } = rect;
  const w = x1 - x0;
  const h = y1 - y0;
  const leaf = new THREE.Group();
  leaf.name = 'liftUp';
  leaf.position.set(x0, y1, zBack); // pivot on the TOP edge
  leaf.userData = { openable: 'flapUp', openAmount: 0 };
  const panel = panelBuilder({ w, h, doorMat, glassMat, handleStyle, handleMat, kind: 'door', hinge: 'L', tag });
  panel.position.y = -h; // panel hangs below the pivot
  leaf.add(panel);
  return leaf;
}

export function buildBiFoldFront({ rect, zBack, doorMat, glassMat, handleStyle, handleMat, tag, panelBuilder = buildShakerPanel }) {
  const { x0, x1, y0, y1 } = rect;
  const w = x1 - x0;
  const half = (y1 - y0) / 2;
  const leaf = new THREE.Group();
  leaf.name = 'biFold';
  leaf.position.set(x0, y1, zBack);
  leaf.userData = { openable: 'biFold', openAmount: 0 };

  // Upper leaf: handleless (the pull is on the lower leaf's bottom edge).
  const upper = panelBuilder({ w, h: half, doorMat, glassMat, handleStyle: 'none', handleMat, kind: 'door', hinge: 'L', tag });
  upper.position.y = -half;
  leaf.add(upper);

  // Lower leaf pivots at the knuckle between the halves and folds back
  // (applyOpenAmount drives its rotation via the biFoldLower name).
  // Bi-folds present handleless — the real hardware is a push/servo drive.
  const lowerPivot = new THREE.Group();
  lowerPivot.name = 'biFoldLower';
  lowerPivot.position.y = -half;
  const lower = panelBuilder({ w, h: half, doorMat, glassMat, handleStyle: 'none', handleMat, kind: 'door', hinge: 'L', tag });
  lower.position.y = -half;
  lowerPivot.add(lower);
  leaf.add(lowerPivot);
  return leaf;
}
