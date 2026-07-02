// Every rebuild must go through here (see CLAUDE.md "Dispose on rebuild").
// Materials owned by the shared material library are marked
// material.userData.shared and are NOT disposed.
export function disposeGroup(root) {
  root.traverse((node) => {
    node.geometry?.dispose();
    const materials = Array.isArray(node.material)
      ? node.material
      : node.material
        ? [node.material]
        : [];
    for (const material of materials) {
      if (material.userData?.shared) continue;
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}
