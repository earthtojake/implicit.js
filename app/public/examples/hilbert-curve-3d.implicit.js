const GLSL = `
float sdHilbertGridSegment(vec3 g, vec3 a, vec3 b) {
  vec3 mn = min(a, b);
  vec3 mx = max(a, b);
  vec3 q = max(max(mn - g, g - mx), vec3(0.0));
  return length(q) * cellSize;
}

float smoothMin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / max(k, 0.0001), 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdf(vec3 p) {
  vec3 g = p / max(cellSize, 0.0001) + vec3(1.5);
  float d = 100000.0;
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(0.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(1.0, 0.0, 0.0), vec3(1.0, 0.0, 1.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(1.0, 0.0, 1.0), vec3(1.0, 1.0, 1.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(1.0, 1.0, 1.0), vec3(0.0, 1.0, 1.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(0.0, 1.0, 1.0), vec3(0.0, 0.0, 1.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(0.0, 0.0, 1.0), vec3(0.0, 0.0, 2.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(0.0, 0.0, 2.0), vec3(0.0, 0.0, 3.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(0.0, 0.0, 3.0), vec3(1.0, 0.0, 3.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(1.0, 0.0, 3.0), vec3(1.0, 0.0, 2.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(1.0, 0.0, 2.0), vec3(1.0, 1.0, 2.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(1.0, 1.0, 2.0), vec3(1.0, 1.0, 3.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(1.0, 1.0, 3.0), vec3(0.0, 1.0, 3.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(0.0, 1.0, 3.0), vec3(0.0, 1.0, 2.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(0.0, 1.0, 2.0), vec3(0.0, 2.0, 2.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(0.0, 2.0, 2.0), vec3(0.0, 2.0, 3.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(0.0, 2.0, 3.0), vec3(0.0, 3.0, 3.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(0.0, 3.0, 3.0), vec3(0.0, 3.0, 2.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(0.0, 3.0, 2.0), vec3(1.0, 3.0, 2.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(1.0, 3.0, 2.0), vec3(1.0, 3.0, 3.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(1.0, 3.0, 3.0), vec3(1.0, 2.0, 3.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(1.0, 2.0, 3.0), vec3(1.0, 2.0, 2.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(1.0, 2.0, 2.0), vec3(1.0, 2.0, 1.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(1.0, 2.0, 1.0), vec3(0.0, 2.0, 1.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(0.0, 2.0, 1.0), vec3(0.0, 3.0, 1.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(0.0, 3.0, 1.0), vec3(1.0, 3.0, 1.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(1.0, 3.0, 1.0), vec3(1.0, 3.0, 0.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(1.0, 3.0, 0.0), vec3(0.0, 3.0, 0.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(0.0, 3.0, 0.0), vec3(0.0, 2.0, 0.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(0.0, 2.0, 0.0), vec3(1.0, 2.0, 0.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(1.0, 2.0, 0.0), vec3(2.0, 2.0, 0.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(2.0, 2.0, 0.0), vec3(3.0, 2.0, 0.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(3.0, 2.0, 0.0), vec3(3.0, 3.0, 0.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(3.0, 3.0, 0.0), vec3(2.0, 3.0, 0.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(2.0, 3.0, 0.0), vec3(2.0, 3.0, 1.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(2.0, 3.0, 1.0), vec3(3.0, 3.0, 1.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(3.0, 3.0, 1.0), vec3(3.0, 2.0, 1.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(3.0, 2.0, 1.0), vec3(2.0, 2.0, 1.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(2.0, 2.0, 1.0), vec3(2.0, 2.0, 2.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(2.0, 2.0, 2.0), vec3(2.0, 2.0, 3.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(2.0, 2.0, 3.0), vec3(2.0, 3.0, 3.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(2.0, 3.0, 3.0), vec3(2.0, 3.0, 2.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(2.0, 3.0, 2.0), vec3(3.0, 3.0, 2.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(3.0, 3.0, 2.0), vec3(3.0, 3.0, 3.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(3.0, 3.0, 3.0), vec3(3.0, 2.0, 3.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(3.0, 2.0, 3.0), vec3(3.0, 2.0, 2.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(3.0, 2.0, 2.0), vec3(3.0, 1.0, 2.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(3.0, 1.0, 2.0), vec3(3.0, 1.0, 3.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(3.0, 1.0, 3.0), vec3(2.0, 1.0, 3.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(2.0, 1.0, 3.0), vec3(2.0, 1.0, 2.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(2.0, 1.0, 2.0), vec3(2.0, 0.0, 2.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(2.0, 0.0, 2.0), vec3(2.0, 0.0, 3.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(2.0, 0.0, 3.0), vec3(3.0, 0.0, 3.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(3.0, 0.0, 3.0), vec3(3.0, 0.0, 2.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(3.0, 0.0, 2.0), vec3(3.0, 0.0, 1.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(3.0, 0.0, 1.0), vec3(3.0, 1.0, 1.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(3.0, 1.0, 1.0), vec3(2.0, 1.0, 1.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(2.0, 1.0, 1.0), vec3(2.0, 0.0, 1.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(2.0, 0.0, 1.0), vec3(2.0, 0.0, 0.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(2.0, 0.0, 0.0), vec3(2.0, 1.0, 0.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(2.0, 1.0, 0.0), vec3(3.0, 1.0, 0.0)), cornerBlend);
  d = smoothMin(d, sdHilbertGridSegment(g, vec3(3.0, 1.0, 0.0), vec3(3.0, 0.0, 0.0)), cornerBlend);
  return d - tubeRadius;
}

vec3 color(vec3 p, vec3 normal) {
  float sweep = 0.5 + 0.5 * sin((p.x + p.y * 0.7 + p.z * 1.3) * 0.12);
  float glow = pow(max(dot(normal, normalize(vec3(-0.35, 0.42, 0.84))), 0.0), 2.0);
  vec3 c = mix(baseColor, midColor, smoothstep(0.0, 0.58, sweep));
  c = mix(c, accentColor, smoothstep(0.48, 1.0, sweep));
  return c * (0.62 + glow * 0.48) + vec3(0.04, 0.05, 0.08);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "3D Hilbert curve",
  description: "A true order-2 3D Hilbert traversal through a 4x4x4 lattice, thickened into a rounded tube.",
  units: "mm",
  params: {
    cellSize: { type: "number", label: "Cell size", min: 5, max: 11, step: 0.25, default: 7.2, unit: "mm" },
    tubeRadius: { type: "number", label: "Tube radius", min: 0.45, max: 2.6, step: 0.05, default: 1.2, unit: "mm" },
    cornerBlend: { type: "number", label: "Corner blend", min: 0.1, max: 2.6, step: 0.05, default: 0.85, unit: "mm" },
    baseColor: { type: "color", label: "Start color", default: "#35d0ff" },
    midColor: { type: "color", label: "Middle color", default: "#baff39" },
    accentColor: { type: "color", label: "End color", default: "#ff65b8" }
  },
  animations: {
    pathPulse: {
      label: "Path pulse",
      duration: 5.6,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("tubeRadius", 1.2 + wave * 0.38);
        set("cornerBlend", 0.85 + (wave * 0.5 + 0.5) * 0.9);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = params.cellSize * 2.05 + params.tubeRadius + params.cornerBlend + 6;
    return [[-extent, -extent, -extent], [extent, extent, extent]];
  },
  render: ({ params }) => ({
    steps: 220,
    stepScale: 0.62,
    maxStep: Math.max(params.tubeRadius * 3.2, 1.1),
    epsilon: Math.max(params.tubeRadius * 0.012, 0.005),
    normalEpsilon: Math.max(params.tubeRadius * 0.07, 0.035)
  }),
  glsl: GLSL
};
