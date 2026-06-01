const GLSL = `
float sdSegment2(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h);
}

vec2 dragonPoint(float i) {
  float t = i / 72.0;
  float a = t * 11.4 + sin(t * 31.0) * 0.28;
  float r = size * (0.16 + 0.78 * sqrt(t));
  vec2 q = vec2(cos(a), sin(a)) * r;
  q += vec2(cos(a * 2.0 + 1.1), sin(a * 2.0 - 0.7)) * size * 0.10;
  if (mod(floor(i / 6.0), 2.0) > 0.5) {
    q = vec2(q.x - q.y, q.x + q.y) * 0.70710678118;
  }
  return q;
}

float dragonField(vec2 p) {
  float d = 100000.0;
  for (int i = 0; i < 72; i += 1) {
    float fi = float(i);
    d = min(d, sdSegment2(p, dragonPoint(fi), dragonPoint(fi + 1.0)));
  }
  return d;
}

float sdf(vec3 p) {
  float ribbon = dragonField(p.xy) - ribbonWidth;
  float slab = abs(p.z) - thickness * 0.5;
  return max(ribbon, slab);
}

vec3 color(vec3 p, vec3 normal) {
  float fold = 0.5 + 0.5 * sin(atan(p.y, p.x) * 5.0 + length(p.xy) * 0.16);
  vec3 c = mix(baseColor, accentColor, fold);
  return c * (0.58 + 0.42 * smoothstep(-0.2, 0.9, normal.z));
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "Dragon curve ribbon",
  description: "A recursively folded dragon-curve-inspired ribbon, thickened into a smooth printable strip.",
  units: "mm",
  params: {
    size: { type: "number", label: "Fold size", min: 12, max: 34, step: 0.5, default: 24, unit: "mm" },
    ribbonWidth: { type: "number", label: "Ribbon width", min: 0.45, max: 2.6, step: 0.05, default: 1.05, unit: "mm" },
    thickness: { type: "number", label: "Thickness", min: 0.8, max: 4, step: 0.1, default: 1.55, unit: "mm" },
    baseColor: { type: "color", label: "Inner color", default: "#5b8cff" },
    accentColor: { type: "color", label: "Fold color", default: "#ff5c8a" }
  },
  animations: {
    foldPulse: {
      label: "Fold pulse",
      duration: 5.8,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("ribbonWidth", 1.05 + wave * 0.32);
        set("thickness", 1.55 + (wave * 0.5 + 0.5) * 0.7);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = params.size * 1.25 + params.ribbonWidth + 6;
    const z = params.thickness + 3;
    return [[-extent, -extent, -z], [extent, extent, z]];
  },
  render: ({ params }) => ({
    steps: 220,
    stepScale: 0.64,
    maxStep: Math.max(params.ribbonWidth * 3.2, 1.0),
    epsilon: Math.max(params.ribbonWidth * 0.012, 0.004),
    normalEpsilon: Math.max(params.ribbonWidth * 0.08, 0.032)
  }),
  glsl: GLSL
};
