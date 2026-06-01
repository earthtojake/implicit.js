const GLSL = `
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float crossVoid(vec3 p, float s) {
  float w = voidWidth * s;
  float tunnelX = max(abs(p.y) - w, abs(p.z) - w);
  float tunnelY = max(abs(p.x) - w, abs(p.z) - w);
  float tunnelZ = max(abs(p.x) - w, abs(p.y) - w);
  return min(tunnelX, min(tunnelY, tunnelZ));
}

float sdf(vec3 p) {
  float d = sdBox(p, vec3(size));
  float v = crossVoid(p, 1.0);
  if (levels > 1.5) {
    vec3 q = mod(p + size * 0.5, size) - size * 0.5;
    v = min(v, crossVoid(q, 0.42));
  }
  if (levels > 2.5) {
    vec3 r = mod(p + size * 0.22, size * 0.44) - size * 0.22;
    v = min(v, crossVoid(r, 0.18));
  }
  return max(d - roundness, -(v + roundness));
}

vec3 color(vec3 p, vec3 normal) {
  float nested = 0.5 + 0.5 * sin((abs(p.x) + abs(p.y) + abs(p.z)) * 0.22);
  vec3 c = mix(baseColor, accentColor, nested);
  return c * (0.56 + 0.44 * pow(max(dot(normal, normalize(vec3(-0.38, 0.42, 0.82))), 0.0), 1.8));
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "Jerusalem cube",
  description: "A Jerusalem-cube-style fractal with nested orthogonal cutouts and rounded internal corners.",
  units: "mm",
  params: {
    size: { type: "number", label: "Half size", min: 12, max: 34, step: 0.5, default: 24, unit: "mm" },
    levels: { type: "number", label: "Levels", min: 1, max: 3, step: 1, default: 3 },
    voidWidth: { type: "number", label: "Void width", min: 1.2, max: 6.5, step: 0.1, default: 3.3, unit: "mm" },
    roundness: { type: "number", label: "Corner round", min: 0.05, max: 1.6, step: 0.05, default: 0.42, unit: "mm" },
    baseColor: { type: "color", label: "Cube color", default: "#ffd166" },
    accentColor: { type: "color", label: "Interior color", default: "#ff5c8a" }
  },
  animations: {
    nestedCuts: {
      label: "Nested cuts",
      duration: 5.6,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("voidWidth", 3.3 + wave * 1.2);
        set("roundness", 0.42 + (wave * 0.5 + 0.5) * 0.55);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = params.size + params.roundness + 5;
    return [[-extent, -extent, -extent], [extent, extent, extent]];
  },
  render: ({ params }) => ({
    steps: 240,
    stepScale: 0.64,
    maxStep: Math.max(params.roundness * 5, 1.0),
    epsilon: Math.max(params.roundness * 0.014, 0.004),
    normalEpsilon: Math.max(params.roundness * 0.12, 0.036)
  }),
  glsl: GLSL
};
