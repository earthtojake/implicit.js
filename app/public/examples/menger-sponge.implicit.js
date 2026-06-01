const GLSL = `
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float menger(vec3 p) {
  vec3 q = p / size;
  float d = sdBox(q, vec3(1.0));
  float scale = 1.0;
  for (int i = 0; i < 4; i += 1) {
    if (float(i) < levels) {
      vec3 a = mod(q * scale + 1.0, 2.0) - 1.0;
      scale *= 3.0;
      vec3 r = abs(1.0 - 3.0 * abs(a));
      float cross = min(max(r.x, r.y), min(max(r.y, r.z), max(r.z, r.x))) / scale;
      d = max(d, cross);
    }
  }
  return d * size - bevel;
}

float sdf(vec3 p) {
  return menger(p);
}

vec3 color(vec3 p, vec3 normal) {
  float cavities = 0.5 + 0.5 * sin((abs(p.x) + abs(p.y) + abs(p.z)) * 0.34);
  vec3 c = mix(baseColor, accentColor, cavities);
  return c * (0.55 + 0.45 * pow(max(dot(normal, normalize(vec3(0.45, 0.36, 0.82))), 0.0), 1.8));
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "Menger sponge",
  description: "A recursive cubic sponge with orthogonal voids and softened printable interior edges.",
  units: "mm",
  params: {
    size: { type: "number", label: "Half size", min: 12, max: 34, step: 0.5, default: 24, unit: "mm" },
    levels: { type: "number", label: "Levels", min: 1, max: 4, step: 1, default: 3 },
    bevel: { type: "number", label: "Edge soften", min: 0.05, max: 1.4, step: 0.05, default: 0.34, unit: "mm" },
    baseColor: { type: "color", label: "Outer color", default: "#b8c0ff" },
    accentColor: { type: "color", label: "Void color", default: "#2df5ff" }
  },
  animations: {
    voidBreath: {
      label: "Void breath",
      duration: 5.5,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("bevel", 0.34 + (wave * 0.5 + 0.5) * 0.55);
        set("size", 24 + wave * 3.0);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = params.size + params.bevel + 5;
    return [[-extent, -extent, -extent], [extent, extent, extent]];
  },
  render: ({ params }) => ({
    steps: 260,
    stepScale: 0.62,
    maxStep: Math.max(params.bevel * 5, 1.0),
    epsilon: Math.max(params.bevel * 0.015, 0.004),
    normalEpsilon: Math.max(params.bevel * 0.12, 0.036)
  }),
  glsl: GLSL
};
