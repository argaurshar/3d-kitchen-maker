import { defineConfig } from 'vite';

// GitHub Pages serves a project site under /<repo>/, so the production build
// must be given a matching base or its asset URLs 404. The deploy workflow
// sets VITE_BASE from the repository name (rename/fork-proof); local dev and
// the screenshot harness run without it and stay at '/'.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
});
