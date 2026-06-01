# API Reference

`implicitjs` is an ESM package. Most applications import from the root entry:

```js
import {
  loadImplicitModuleFromSource,
  normalizeImplicitModel,
  renderImplicitToDataUrl,
  snapshotImplicitCadModel,
  exportImplicitModel,
  exportImplicitAnimatedGlb
} from "implicitjs";
```

Subpath exports are available when you want a narrower import.

## Loading

```js
import { loadImplicitModule, loadImplicitModuleFromSource } from "implicitjs/loader";

const modelFromUrl = await loadImplicitModule("/models/sphere.implicit.js");
const modelFromSource = await loadImplicitModuleFromSource(source);
```

Aliases:

- `loadImplicitModule` is also exported as `loadImplicitCadModule`.
- `loadImplicitModuleFromSource` is also exported as `loadImplicitSource`.
- `peekImplicitModule(url)` returns a cached model when one has already loaded.

Loaded models are normalized runtime models with bounds, parameters, uniforms,
render settings, and a `definition.buildModel(params, animationState)` helper.

## Normalizing

```js
import { normalizeImplicitModel } from "implicitjs/model";

const model = normalizeImplicitModel(moduleValue);
const larger = model.definition.buildModel({ radius: 30 });
```

Useful normalized fields include:

| Field | Meaning |
| --- | --- |
| `name`, `description`, `units` | Display metadata. |
| `parameters`, `parameterMap` | Normalized parameter definitions. |
| `defaultParameterValues`, `parameterValues` | Default and active values. |
| `animations`, `animationState` | Normalized animation metadata. |
| `glslSource`, `colorSource` | GLSL used by render and CPU evaluators. |
| `uniforms`, `uniformSignature` | Auto-generated shader uniforms. |
| `bounds`, `center`, `size`, `radius` | Spatial information. |
| `maxSteps`, `maxDistance`, `epsilon`, `normalEpsilon` | Render controls. |

## Rendering

```js
import * as THREE from "three";
import { renderImplicitToDataUrl } from "implicitjs/render";

const dataUrl = await renderImplicitToDataUrl(THREE, model, {
  width: 1200,
  height: 900,
  camera: "iso",
  render: { frameMargin: 1.45 },
  graphics: { modelColors: true, detail: 1.2 }
});
```

Camera presets include `iso`, `front`, `back`, `left`, `right`, `top`, and
`bottom`. Cameras may also be objects with `position`, `target`, `up`,
`direction`, `preset`, and `zoom`.

Lower-level rendering helpers are available from `implicitjs/render`:

- `createImplicitFullscreenScene(THREE, model)`
- `configureImplicitCamera(THREE, model, width, height, camera, options)`
- `updateImplicitModelUniforms(THREE, material, model)`
- `updateImplicitAppearanceUniforms(THREE, material, model, options)`
- `updateImplicitGraphicsUniforms(material, model, graphics)`
- `updateImplicitMaterialUniforms(material, camera, width, height)`
- `implicitModelShaderKey(model)`

## Snapshots

```js
import * as THREE from "three";
import { snapshotImplicitCadModel } from "implicitjs/snapshot";

const snapshot = await snapshotImplicitCadModel(THREE, model, {
  path: "/tmp/model.png",
  width: 1600,
  height: 1200,
  camera: "iso"
});

console.log(snapshot.dataUrl);
```

Use `snapshotImplicitCadModelToDataUrl` when you only need the data URL.

## Mesh Sampling

```js
import { meshImplicitCadModel } from "implicitjs/mesh";

const mesh = meshImplicitCadModel(model, {
  resolution: 96,
  maxCells: 2500000,
  smoothNormals: true
});
```

The sampler evaluates the SDF inside the model bounds. Higher `resolution`
values create denser meshes and take longer. Resolution is clamped between 8 and
192.

The mesh object includes flat `positions`, `normals`, `triangleCount`,
`vertexCount`, and the sampling `grid`.

## Exports

```js
import { exportImplicitModel, exportImplicitAnimatedGlb } from "implicitjs/exportModel";

const glb = exportImplicitModel(model, {
  format: "glb",
  resolution: 96,
  params: { radius: 24 }
});

const animated = exportImplicitAnimatedGlb(model, {
  animationId: "breathe",
  frames: 24,
  resolution: 72
});
```

Supported static formats are `glb`, `stl`, and `3mf`. `gltf` normalizes to
`glb`.

For path-based exports in Node, use `implicitjs/export`:

```js
import { exportImplicitCadFile } from "implicitjs/export";

await exportImplicitCadFile({
  input: "model.implicit.js",
  output: "model.glb",
  format: "glb"
});
```

Export results include:

| Field | Meaning |
| --- | --- |
| `body` | File bytes as a `Uint8Array` or buffer-like value. |
| `contentType` | MIME type for downloads. |
| `extension` | Suggested file extension. |
| `format` | Normalized export format. |
| `mesh` | Sampled mesh metadata and arrays. |
| `model` | Runtime model used for export. |

## CPU SDF Evaluation

```js
import { createImplicitCadSdfEvaluator } from "implicitjs/sdfEvaluator";

const sdf = createImplicitCadSdfEvaluator(model);
const distance = sdf(0, 0, 0);
```

CPU evaluation supports the GLSL subset and built-ins used by the package. It is
used for bounds estimation, mesh sampling, mesh quality checks, and exports.

## Mesh Quality

```js
import { analyzeImplicitMeshQuality } from "implicitjs/meshQuality";

const report = analyzeImplicitMeshQuality(mesh, { model });
```

The report checks triangle counts, bounds, degenerate triangles, non-finite
values, boundary edges, non-manifold edges, normal alignment, and sampled
orientation against the SDF when a model or SDF is provided.

## Graphics Settings

```js
import {
  DEFAULT_IMPLICIT_GRAPHICS_SETTINGS,
  normalizeImplicitGraphicsSettings
} from "implicitjs/graphicsSettings";
```

Graphics settings control render scale, interaction scale, detail, normal
smoothing, model colors, shadows, ambient occlusion, and rim lighting.

## Subpath Exports

| Import | Purpose |
| --- | --- |
| `implicitjs/model` | Schema normalization and runtime models. |
| `implicitjs/loader` | Module and source loading. |
| `implicitjs/render` | Three.js shader and camera helpers. |
| `implicitjs/snapshot` | PNG snapshot helpers. |
| `implicitjs/mesh` | SDF mesh sampling. |
| `implicitjs/meshQuality` | Mesh quality analysis. |
| `implicitjs/export` | Path-based export helpers and `exportImplicitCadModel` APIs. |
| `implicitjs/exportModel` | In-memory export APIs with short aliases. |
| `implicitjs/sdfEvaluator` | CPU SDF and color evaluators. |
| `implicitjs/animation` | Animation helpers. |
| `implicitjs/graphicsSettings` | Render graphics settings. |
| `implicitjs/common/*` | Shared camera, parameter, theme, and render-option helpers. |
