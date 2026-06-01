# CLI Reference

The package includes snapshot and export CLIs. Run them from `package/` in this
repository, or call the script files directly from an installed package.

## Snapshot

```bash
npm run snapshot -- --input ../app/public/examples/mobius-strip.implicit.js --output /tmp/mobius.png
```

The snapshot command renders `.implicit.js` and `.implicit.mjs` models in a
headless browser.

Common options:

| Option | Purpose |
| --- | --- |
| `--input` | Input model file. |
| `--output`, `-o` | Output PNG or GIF path. |
| `--mode` | `view`, `orbit`, or `animate`. |
| `--camera` | Preset, `azimuth:elevation`, or JSON camera object. |
| `--appearance` | Theme id, inline JSON, or JSON file path. |
| `--size-profile` | Named render size profile. |
| `--width`, `--height` | Explicit output size. |
| `--params` | JSON object of model parameter values. |
| `--graphics` | JSON object of graphics settings. |
| `--job` | JSON render job path, or `-` for stdin. |
| `--json` | Print machine-readable command output. |

Examples:

```bash
npm run snapshot -- --input ../app/public/examples/rounded-orb.implicit.js --output /tmp/orb.png --camera iso
npm run snapshot -- --input ../app/public/examples/rounded-orb.implicit.js --output /tmp/orb.gif --mode orbit
npm run snapshot -- --input ../app/public/examples/rounded-orb.implicit.js --output /tmp/orb.png --params '{"radius":28}'
```

## Snapshot Jobs

A job can render several outputs while reusing the same browser, module, and
runtime model.

```json
{
  "input": "../app/public/examples/mobius-strip.implicit.js",
  "render": { "frameMargin": 1.55 },
  "graphics": { "modelColors": true, "detail": 1.2 },
  "outputs": [
    { "path": "/tmp/mobius-iso.png", "camera": "iso" },
    { "path": "/tmp/mobius-front.png", "camera": "front" },
    { "path": "/tmp/mobius-top.png", "camera": "top" }
  ]
}
```

Run it:

```bash
npm run snapshot -- --job /tmp/mobius-job.json
```

`--job` accepts a single job, an array of jobs, or an object shaped like
`{ "jobs": [...] }`. Output paths receive a shared UTC seconds timestamp before
the extension.

## Export

```bash
npm run export -- --input ../app/public/examples/rounded-orb.implicit.js --format glb --output /tmp/orb.glb
```

The export command samples the SDF inside the model bounds and writes a mesh
file.

Options:

| Option | Purpose |
| --- | --- |
| `--input`, `-i` | Input `.implicit.js` or `.implicit.mjs` file. |
| `--output`, `-o` | Output file. Defaults to the input stem plus the selected format. |
| `--format`, `-f` | `glb`, `stl`, or `3mf`. |
| `--resolution` | Longest-axis sampling resolution. Default: 96. |
| `--max-cells` | Safety cap for grid cells. Default: 2500000. |
| `--params` | JSON object of model parameter values. |
| `--animation` | JSON object of animation state. |
| `--animated` | Export animated GLB morph targets from a model animation. |
| `--frames` | Animated GLB frame count. Default: 18. |
| `--duration` | Animated GLB duration in seconds. |
| `--json` | Print machine-readable result JSON. |

Examples:

```bash
npm run export -- --input ../app/public/examples/rounded-orb.implicit.js --format stl --resolution 96
npm run export -- --input ../app/public/examples/rounded-orb.implicit.js --format 3mf --params '{"radius":28}'
npm run export -- --input ../app/public/examples/parametric-pulse.implicit.js --animated --animation '{"activeId":"breathe"}' --frames 24 --output /tmp/pulse.glb
```

Higher resolution creates denser meshes and takes longer. If an export is empty,
check the model bounds, parameter values, and SDF sign convention.
