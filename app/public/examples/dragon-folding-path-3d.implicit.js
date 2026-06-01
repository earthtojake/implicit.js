const GLSL = `
float sdSegment(vec3 p, vec3 a, vec3 b) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h);
}

float smoothMin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / max(k, 0.0001), 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

vec3 dragon3Point(float i) {
  float t = i / 54.0;
  float angle = t * 13.2 + sin(t * 23.0) * 0.34;
  float r = size * (0.2 + 0.72 * sqrt(t));
  vec3 q = vec3(cos(angle) * r, sin(angle) * r, sin(t * 18.8495559) * height);
  if (mod(floor(i / 5.0), 2.0) > 0.5) {
    q.xy = vec2(q.x - q.y, q.x + q.y) * 0.70710678118;
    q.z = -q.z * 0.78;
  }
  return q;
}

float sdf(vec3 p) {
  float d = 100000.0;
  for (int i = 0; i < 54; i += 1) {
    float fi = float(i);
    d = smoothMin(d, sdSegment(p, dragon3Point(fi), dragon3Point(fi + 1.0)), bendBlend);
  }
  return d - tubeRadius;
}

vec3 color(vec3 p, vec3 normal) {
  float fold = 0.5 + 0.5 * sin(length(p.xy) * 0.18 + p.z * 0.32);
  float light = pow(max(dot(normal, normalize(vec3(-0.52, 0.32, 0.79))), 0.0), 2.0);
  return mix(baseColor, accentColor, fold) * (0.58 + light * 0.48);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "3D dragon folding path",
  description: "A sculptural 3D recursive folding path inspired by dragon-curve turns.",
  units: "mm",
  params: {
    size: { type: "number", label: "Planar spread", min: 12, max: 34, step: 0.5, default: 23, unit: "mm" },
    height: { type: "number", label: "Vertical fold", min: 2, max: 16, step: 0.25, default: 7.5, unit: "mm" },
    tubeRadius: { type: "number", label: "Tube radius", min: 0.45, max: 2.5, step: 0.05, default: 1.05, unit: "mm" },
    bendBlend: { type: "number", label: "Bend blend", min: 0.1, max: 2.2, step: 0.05, default: 0.7, unit: "mm" },
    baseColor: { type: "color", label: "Base color", default: "#2df5a5" },
    accentColor: { type: "color", label: "Fold color", default: "#ffcc33" }
  },
  animations: {
    foldOrbit: {
      label: "Fold orbit",
      duration: 6.4,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("height", 7.5 + wave * 4.5);
        set("bendBlend", 0.7 + (wave * 0.5 + 0.5) * 0.85);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = params.size * 1.28 + params.tubeRadius + 6;
    const z = params.height + params.tubeRadius + 6;
    return [[-extent, -extent, -z], [extent, extent, z]];
  },
  render: ({ params }) => ({
    steps: 220,
    stepScale: 0.64,
    maxStep: Math.max(params.tubeRadius * 3.2, 1.0),
    epsilon: Math.max(params.tubeRadius * 0.012, 0.0045),
    normalEpsilon: Math.max(params.tubeRadius * 0.075, 0.034)
  }),
  glsl: GLSL
};
