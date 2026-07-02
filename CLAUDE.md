# CLAUDE.md — Standing rules for this repository

These rules govern every change in this project. Read them before writing code.

## Architecture

- **Single source of truth.** All scene content lives as JSON in the state store
  (`src/state/store.js`). The 3D layer is a pure projection of that JSON. The UI
  never touches THREE objects directly: it writes to the store, the store
  notifies its subscribers, and the 3D layer rebuilds the affected item only.
- **Pure generators.** Every geometry generator is a pure function
  `(params, materialLibrary) => THREE.Group`. No side effects, no store reads
  inside generators.
- **Dispose on rebuild.** Every rebuild must call `disposeGroup(oldGroup)`,
  which traverses the group and disposes geometries and non-shared materials.
  Memory leaks are bugs.

## Conventions

- **Units.** Meters internally, everywhere. The UI displays **cm** for cabinet
  dimensions and **m** for appliance dimensions.
- **Mesh tagging.** Every mesh gets
  `userData: { itemId, moduleId?, compartmentId?, surfaceRole }`, where
  `surfaceRole` is one of: `doorFront`, `drawerFront`, `carcass`, `worktop`,
  `plinth`, `handle`, `applianceBody`, `wall`, `floor`, `seat`, `leg`.
  This drives picking and painting.
- **File size.** Files stay under ~300 lines. Split modules rather than growing
  files.

## Workflow

- After completing any visual feature: run the screenshot suite, **look** at the
  images, iterate until the acceptance criteria pass, then `git commit` with a
  descriptive message. Never claim a visual feature works without viewing a
  screenshot of it.
- Update the checklist in `SPEC.md` whenever a feature lands.
