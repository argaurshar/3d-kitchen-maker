import { applyCameraPreset, elevationView, DEFAULT_FOV } from './camera.js';
import { WALL_LABELS, summarizeWall } from '../state/elements.js';

// Composes a 2D drawing sheet from the live scene: the four wall elevations
// plus plan and a 3D key view, each with a caption naming the wall and the
// elements detected against it, under a title block with the room dimensions.
// Renders synchronously into the existing renderer canvas (same trick as the
// Share contact sheet) so the WebGL buffer is still valid for drawImage.
const TITLE_H = 64;
const CAPTION_H = 30;
const PAD = 14;

export function renderElevationSheet({ renderer, scene, camera, controls, projection, sceneState }) {
  const dom = renderer.domElement;
  const cw = Math.round(dom.width / 2);
  const ch = Math.round(dom.height / 2);
  const cell = ch + CAPTION_H;
  const sheet = document.createElement('canvas');
  sheet.width = cw * 2 + PAD * 3;
  sheet.height = TITLE_H + cell * 3 + PAD * 4;
  const ctx = sheet.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sheet.width, sheet.height);

  const room = sceneState.room;
  ctx.fillStyle = '#1b1d20';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillText('Kitchen — elevations & plan', PAD, 32);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#5f646a';
  ctx.fillText(
    `Room ${room.width.toFixed(2)} × ${room.depth.toFixed(2)} m · walls ${room.wallHeight.toFixed(2)} m · ${sceneState.items.length} elements`,
    PAD,
    52
  );

  const saved = { position: camera.position.clone(), target: controls.target.clone(), fov: camera.fov };
  const views = [
    ['north', 'south'],
    ['east', 'west'],
    ['plan', 'iso'],
  ];
  views.forEach((row, r) =>
    row.forEach((view, c) => {
      const x = PAD + c * (cw + PAD);
      const y = TITLE_H + PAD + r * (cell + PAD);
      const isWall = view !== 'plan' && view !== 'iso';
      applyCameraPreset(
        camera,
        controls,
        isWall ? elevationView(room, view, cw / ch) : view === 'plan' ? 'top' : 'hero'
      );
      projection.update(camera); // refresh wall auto-hide for this viewpoint
      renderer.render(scene, camera);
      ctx.drawImage(dom, x, y, cw, ch);
      ctx.strokeStyle = '#d6d8db';
      ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
      ctx.fillStyle = '#1b1d20';
      ctx.font = '600 13px system-ui, sans-serif';
      const title = isWall ? `${WALL_LABELS[view]} elevation` : view === 'plan' ? 'Plan' : '3D view';
      ctx.fillText(title, x, y + ch + 19);
      if (isWall) {
        const titleW = ctx.measureText(title).width;
        ctx.fillStyle = '#5f646a';
        ctx.font = '12px system-ui, sans-serif';
        const detail = summarizeWall(sceneState, view);
        ctx.fillText(detail.length > 64 ? `${detail.slice(0, 61)}…` : detail, x + titleW + 12, y + ch + 19);
      }
    })
  );

  camera.position.copy(saved.position);
  controls.target.copy(saved.target);
  camera.fov = saved.fov ?? DEFAULT_FOV;
  camera.updateProjectionMatrix();
  controls.update();
  projection.update(camera);
  return sheet;
}
