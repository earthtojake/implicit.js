# Model Format

An implicit.js model is an ES module that exports an object, or a function that
returns an object. Files usually end in `.implicit.js` or `.implicit.mjs`.

The current schema id is `implicit.js/0.1.0`.

## Minimal Model

```js
export default {
  schema: "implicit.js/0.1.0",
  name: "sphere",
  units: "mm",
  bounds: 30,
  glsl: `
float sdf(vec3 p) {
  return implicit_sphere(p, vec3(0.0), 24.0);
}
`
};
```

The `glsl` string must define:

```glsl
float sdf(vec3 p)
```

It can also define procedural color:

```glsl
vec3 color(vec3 p, vec3 normal)
```

Distances are negative inside the solid, positive outside, and zero at the
surface.

## Fields

| Field | Type | Purpose |
| --- | --- | --- |
| `schema` | string | Use `implicit.js/0.1.0`. |
| `name` | string | Display name for previews and exports. |
| `description` | string | Optional human-readable summary. |
| `units` | string | Unit label. Defaults to `mm`. |
| `params` | object or array | Parameter definitions for UI controls and uniforms. |
| `values` | object | Optional initial parameter values. |
| `bounds` | number, array, object, or function | Model bounds for rendering and export. |
| `render` | object or function | Raymarch settings. |
| `animations` | object or array | Parameter animation definitions. |
| `glsl` | string or function | GLSL source containing `sdf`, and optionally `color`. |

## Parameters

Parameter definitions can be an object keyed by id:

```js
params: {
  radius: { type: "number", label: "Radius", min: 5, max: 50, default: 22, unit: "mm" },
  hollow: { type: "boolean", label: "Hollow", default: false },
  tint: { type: "color", label: "Tint", default: "#47a3ff" },
  mode: {
    type: "enum",
    label: "Mode",
    options: ["soft", "sharp"],
    default: "soft"
  }
}
```

They can also be an array with explicit `id` fields.

Supported parameter types:

| Type | Notes |
| --- | --- |
| `number` | Clamped between `min` and `max`; becomes a GLSL `float` uniform. |
| `boolean` | Becomes a GLSL `bool` uniform. |
| `color` | Hex color; becomes a GLSL `vec3` uniform in 0..1 RGB. |
| `button` | Incrementing integer event value; becomes a GLSL `int` uniform. |
| `enum` or `select` | String option for UI and dynamic JS model code. |
| `string` | String value for UI and dynamic JS model code. |

Parameter ids used as uniforms must be valid GLSL identifiers and must not start
with `gl_`. Use the parameter name directly in GLSL; implicit.js injects the
matching uniform declaration.

## Bounds

Bounds tell the renderer and mesh sampler where to look for the surface.

```js
bounds: 40
```

The numeric form creates a cube from `[-40, -40, -40]` to `[40, 40, 40]`.

```js
bounds: [[-30, -20, -10], [30, 20, 10]]
```

The array form is `[min, max]`.

```js
bounds: { min: [-30, -20, -10], max: [30, 20, 10] }
```

The object form is useful when generating bounds from another tool.

```js
bounds: ({ params }) => params.radius + 4
```

Functions receive the current model context. If `bounds` is omitted, set to
`"auto"`, or set to `{ auto: true }`, implicit.js estimates bounds from the SDF.
Explicit bounds are still recommended for thin surfaces, periodic structures,
animated size changes, and export-heavy workflows.

## Dynamic Fields

The `bounds`, `render`, and `glsl` fields may be functions. They receive a
context like this:

```js
{
  params,
  parameterValues,
  radius,
  elapsed,
  elapsedSec,
  duration,
  progress,
  cycle,
  t,
  time,
  animation,
  animationState
}
```

Parameter values are available both in `params` and as top-level properties.

## Render Settings

```js
render: {
  steps: 192,
  maxDistance: 400,
  stepScale: 0.45,
  maxStep: 4,
  epsilon: 0.01,
  normalEpsilon: 0.025
}
```

Common settings:

| Setting | Purpose |
| --- | --- |
| `steps` | Raymarch step limit. Clamped from 16 to 768. |
| `maxDistance` | Maximum ray distance. |
| `stepScale` | Multiplier applied to SDF step size. |
| `maxStep` | Largest allowed ray step. |
| `epsilon` | Hit threshold. |
| `normalEpsilon` | Offset used for normal estimates. |

Defaults are derived from the model bounds and work for most models.

## Animations

Animations update parameter values over time.

```js
animations: {
  breathe: {
    label: "Breathe",
    duration: 2,
    loop: true,
    update({ params, progress, set }) {
      const pulse = Math.sin(progress * Math.PI * 2) * 0.5 + 0.5;
      set("radius", params.radius + pulse * 6);
    }
  }
}
```

The `set(id, value)` helper normalizes the new value against the parameter
definition. Animated GLB export uses these same animation definitions.

## GLSL Helpers

Authored GLSL can call built-in helpers in the `implicit_*` namespace. Common
helpers include:

| Category | Examples |
| --- | --- |
| Primitives | `implicit_sphere`, `implicit_box_centered`, `implicit_torus`, `implicit_cylinder_capped`, `implicit_capsule` |
| 2D/3D distance tools | `implicit_plane`, `implicit_plane2`, `implicit_line_segment`, `implicit_line_segment2` |
| Booleans and blends | `implicit_union_sharp`, `implicit_intersect_sharp`, `implicit_union_round`, `implicit_intersect_round`, `implicit_union_chamfer`, `implicit_intersect_chamfer` |
| Transforms and repeats | `implicit_rotate_axis`, `implicit_repeat_centered`, `implicit_remap_cylindrical` |
| Shells and lattices | `implicit_shell`, `implicit_tpms_gyroid`, `implicit_tpms_schwarz`, `implicit_tpms_diamond`, `implicit_cubic_grid`, `implicit_hexagonal_honeycomb` |

The renderer also promotes many integer literals to GLSL floats so model snippets
can stay pleasant to write.
