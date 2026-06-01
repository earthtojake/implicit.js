# implicitjs

Browser-native implicit CAD for JavaScript apps.

`implicitjs` loads `.implicit.js` model files, renders them with Three.js,
generates PNG/GIF previews, samples SDF meshes, and exports STL, 3MF, and GLB
artifacts.

## Install

```bash
npm install implicitjs
```

## Tiny Model

```js
export default {
  schema: "implicit.js/0.1.0",
  name: "parametric sphere",
  units: "mm",
  params: {
    radius: { type: "number", min: 5, max: 50, default: 22, unit: "mm" }
  },
  bounds: ({ params }) => params.radius + 2,
  glsl: `
float sdf(vec3 p) {
  return implicit_sphere(p, vec3(0.0), radius);
}
`
};
```

## Use It

```js
import * as THREE from "three";
import { loadImplicitModuleFromSource, renderImplicitToDataUrl } from "implicitjs";

const model = await loadImplicitModuleFromSource(source);
const png = await renderImplicitToDataUrl(THREE, model, {
  width: 1200,
  height: 900,
  camera: "iso"
});
```

## Reference

- [Project README](https://github.com/earthtojake/implicit.js#readme)
- [Model format](https://github.com/earthtojake/implicit.js/blob/main/docs/model-format.md)
- [API](https://github.com/earthtojake/implicit.js/blob/main/docs/api.md)
- [CLI](https://github.com/earthtojake/implicit.js/blob/main/docs/cli.md)
- [Development](https://github.com/earthtojake/implicit.js/blob/main/docs/development.md)

MIT. See [LICENSE](https://github.com/earthtojake/implicit.js/blob/main/LICENSE).
