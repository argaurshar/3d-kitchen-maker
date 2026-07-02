import * as THREE from 'three';
import { store } from '../state/store.js';

const EYE_HEIGHT = 1.6;
const SPEED = 1.8; // m/s, believable walking pace
const MARGIN = 0.3;

// First-person walk: pointer lock + WASD + mouse look, clamped inside the
// room bounds. Escape (or losing pointer lock) exits.
export function createWalk({ camera, controls, renderer, picker }) {
  let active = false;
  let saved = null;
  let yaw = 0;
  let pitch = 0;
  const keys = new Set();
  let onExitCallback = null;

  function applyLook() {
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = 0;
  }

  function onMouseMove(event) {
    if (!active || document.pointerLockElement !== renderer.domElement) return;
    yaw -= event.movementX * 0.0022;
    pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.0022, -1.2, 1.2);
    applyLook();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') return exit();
    keys.add(event.code);
  }
  const onKeyUp = (event) => keys.delete(event.code);

  function onLockChange() {
    // Browser-initiated Escape releases the lock; follow it out.
    if (active && document.pointerLockElement !== renderer.domElement) exit();
  }

  function enter() {
    if (active) return;
    active = true;
    picker.select(null);
    picker.setSuspended(true);
    document.body.classList.add('walk-mode');
    saved = { position: camera.position.clone(), target: controls.target.clone(), enabled: controls.enabled };
    controls.enabled = false;
    camera.position.set(1.4, EYE_HEIGHT, 1.4);
    // Face the room center: camera looks along (-sin yaw, 0, -cos yaw).
    yaw = Math.atan2(camera.position.x, camera.position.z);
    pitch = 0;
    applyLook();
    renderer.domElement.requestPointerLock?.();
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onLockChange);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  function exit() {
    if (!active) return;
    active = false;
    keys.clear();
    document.body.classList.remove('walk-mode');
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('pointerlockchange', onLockChange);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    camera.position.copy(saved.position);
    controls.target.copy(saved.target);
    controls.enabled = saved.enabled;
    camera.rotation.set(0, 0, 0);
    controls.update();
    picker.setSuspended(false);
    onExitCallback?.();
  }

  function update(dt) {
    if (!active) return;
    let fx = 0;
    let fz = 0;
    if (keys.has('KeyW')) fz -= 1;
    if (keys.has('KeyS')) fz += 1;
    if (keys.has('KeyA')) fx -= 1;
    if (keys.has('KeyD')) fx += 1;
    if (!fx && !fz) return;
    const len = Math.hypot(fx, fz);
    const step = (SPEED * dt) / len;
    // Move in the camera's yaw frame (horizontal only).
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    camera.position.x += (fx * cos + fz * sin) * step;
    camera.position.z += (-fx * sin + fz * cos) * step;
    const room = store.get().room;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -room.width / 2 + MARGIN, room.width / 2 - MARGIN);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -room.depth / 2 + MARGIN, room.depth / 2 - MARGIN);
    camera.position.y = EYE_HEIGHT;
  }

  return {
    enter,
    exit,
    update,
    isActive: () => active,
    onExit(cb) {
      onExitCallback = cb;
    },
  };
}
