# Development

This repository has two main workspaces:

| Path | Purpose |
| --- | --- |
| `package/` | The reusable `implicitjs` package. |
| `app/` | A Vite demo app that consumes the local package. |

## Package

```bash
cd package
npm install
npm test
```

Useful scripts:

| Script | Purpose |
| --- | --- |
| `npm test` | Run package tests. |
| `npm run snapshot` | Render PNG/GIF snapshots from `.implicit.js` files. |
| `npm run export` | Export STL, 3MF, or GLB meshes. |
| `npm run verify:exports` | Verify export behavior for an input model. |

Package source layout:

| Path | Purpose |
| --- | --- |
| `src/index.js` | Public package entrypoint. |
| `src/browser.js` | Browser-oriented entrypoint. |
| `src/common/` | Shared camera, parameter, theme, render-option, and snapshot helpers. |
| `src/lib/implicitCad/` | Schema, models, loading, rendering, CPU evaluation, mesh sampling, quality checks, and exporters. |
| `src/lib/viewer/` | Render presentation defaults used by shaders. |
| `scripts/` | Snapshot, export, verification, and test CLIs. |

Tests live beside the modules they cover as `*.test.js`.

Keep the package reusable and UI-independent. Runtime behavior that applies to
model normalization, rendering, snapshots, CPU sampling, mesh export, graphics
settings, parameters, and animations belongs in `package/`. Product-specific UI
state, catalogs, editors, routing, and persistence belong in consuming apps.

## Demo App

```bash
cd app
npm install
npm run dev
```

The demo app depends on the local package through:

```json
"implicitjs": "file:../package"
```

It includes:

- A CodeMirror editor for `.implicit.js` source.
- Live Three.js preview.
- Parameter and graphics controls.
- Example models in `app/public/examples/`.
- Snapshot and export flows.

The app is useful for manual testing, visual checks, and exploring model authoring
patterns.

## Example Models

Examples live in `app/public/examples/` and are indexed by
`app/public/examples/index.json`.

Good examples should:

- Export a valid `implicit.js/0.1.0` model.
- Use explicit bounds when the surface is thin, periodic, or animated.
- Keep parameter ids valid as GLSL identifiers when used as uniforms.
- Prefer clear display names and units.
- Run at interactive preview quality in the demo app.

## Manual Checks

For package changes:

```bash
cd package
npm test
```

For export changes:

```bash
cd package
npm run verify:exports -- --input ../app/public/examples/rounded-orb.implicit.js
```

For UI changes:

```bash
cd app
npm run build
npm run dev
```

Then open the local Vite URL and verify preview, controls, examples, snapshots,
and exports.
