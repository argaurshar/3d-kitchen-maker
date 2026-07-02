import * as THREE from 'three';

// Yellow-green edge outline for hover/selection. Built once per item group
// and cached by group identity — a rebuilt item gets a fresh group, so the
// WeakMap misses and the outline is rebuilt (the old one was disposed with
// its group by disposeGroup).
const cache = new WeakMap();

const edgeMaterial = new THREE.LineBasicMaterial({
  color: 0xd7e34a,
  transparent: true,
  opacity: 0.95,
});
edgeMaterial.userData.shared = true;

export function highlightFor(itemGroup) {
  let container = cache.get(itemGroup);
  if (container) return container;

  container = new THREE.Group();
  container.name = 'highlight';
  container.visible = false;

  itemGroup.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(itemGroup.matrixWorld).invert();
  itemGroup.traverse((node) => {
    if (!node.isMesh) return;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(node.geometry, 25), edgeMaterial);
    lines.matrix.multiplyMatrices(inverse, node.matrixWorld);
    lines.matrix.decompose(lines.position, lines.quaternion, lines.scale);
    lines.raycast = () => {}; // never pickable
    container.add(lines);
  });

  cache.set(itemGroup, container);
  itemGroup.add(container);
  return container;
}
