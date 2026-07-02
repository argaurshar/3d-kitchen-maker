// Scene state store — the single source of truth (see CLAUDE.md).
// Implemented in Prompt 3: holds the Scene JSON, exposes get/update/subscribe,
// and notifies subscribers which items changed so the 3D layer can rebuild
// only those items.
