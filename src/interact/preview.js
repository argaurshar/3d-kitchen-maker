// Preview mode: hides all editing chrome and locks a gentle auto-orbit
// around the scene center. Any click or Escape exits back to edit.
export function createPreview({ camera, controls, renderer, picker, projection }) {
  let active = false;
  let saved = null;
  let onExitCallback = null;

  function setGridVisible(visible) {
    const grid = projection.getRoomGroup()?.getObjectByName('studioGrid');
    if (grid) grid.visible = visible;
  }

  function enter() {
    if (active) return;
    active = true;
    picker.select(null);
    picker.setSuspended(true);
    document.body.classList.add('preview-mode');
    setGridVisible(false);
    saved = {
      position: camera.position.clone(),
      target: controls.target.clone(),
      autoRotate: controls.autoRotate,
      rotate: controls.enableRotate,
      pan: controls.enablePan,
      zoom: controls.enableZoom,
    };
    controls.target.set(0, 0.7, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;
    // Lock user input but keep controls enabled: update() (and therefore
    // autoRotate) is gated on .enabled in current three.
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = false;
    // Register the exit listener on the next tick so the click that
    // entered preview doesn't immediately exit it.
    setTimeout(() => {
      if (active) renderer.domElement.addEventListener('pointerdown', exit, { capture: true, once: true });
    }, 0);
    window.addEventListener('keydown', onKey);
  }

  function onKey(event) {
    if (event.key === 'Escape') exit();
  }

  function exit() {
    if (!active) return;
    active = false;
    document.body.classList.remove('preview-mode');
    setGridVisible(true);
    controls.autoRotate = saved.autoRotate;
    controls.enableRotate = saved.rotate;
    controls.enablePan = saved.pan;
    controls.enableZoom = saved.zoom;
    camera.position.copy(saved.position);
    controls.target.copy(saved.target);
    controls.update();
    picker.setSuspended(false);
    window.removeEventListener('keydown', onKey);
    onExitCallback?.();
  }

  return {
    enter,
    exit,
    isActive: () => active,
    onExit(cb) {
      onExitCallback = cb;
    },
  };
}
