const GLSL = `
float sdSegment2(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h);
}

float arrowMotif(vec2 p) {
  vec2 a = vec2(-0.86, -0.50);
  vec2 b = vec2(0.0, 0.98);
  vec2 c = vec2(0.86, -0.50);
  float d = sdSegment2(p, a, b);
  d = min(d, sdSegment2(p, b, c));
  d = min(d, sdSegment2(p, a, c) * 1.18);
  return d;
}

float recursiveArrow(vec2 p) {
  vec2 q = p / size;
  float d = arrowMotif(q) * size;
  float scale = 1.0;
  for (int i = 0; i < 5; i += 1) {
    if (float(i) < levels) {
      scale *= 2.0;
      vec2 r = q * scale;
      r = fract(r + vec2(0.5, 0.0)) - vec2(0.5);
      r.y += 0.16 * sin(float(i) * 2.1);
      d = min(d, arrowMotif(r * 2.0) * size / scale);
    }
  }
  return d;
}

float sdf(vec3 p) {
  float curve = recursiveArrow(p.xy) - pathRadius;
  float slab = abs(p.z) - thickness * 0.5;
  return max(curve, slab);
}

vec3 color(vec3 p, vec3 normal) {
  float recursiveBand = 0.5 + 0.5 * sin((abs(p.x) + abs(p.y) * 1.7) * 0.26);
  vec3 c = mix(baseColor, accentColor, recursiveBand);
  return c * (0.56 + 0.44 * smoothstep(-0.2, 0.9, normal.z));
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "Sierpinski arrowhead curve",
  description: "A raised recursive triangular arrowhead curve with sharp self-similar structure.",
  units: "mm",
  params: {
    size: { type: "number", label: "Triangle size", min: 16, max: 42, step: 0.5, default: 28, unit: "mm" },
    levels: { type: "number", label: "Recursion levels", min: 1, max: 5, step: 1, default: 4 },
    pathRadius: { type: "number", label: "Path radius", min: 0.25, max: 1.8, step: 0.05, default: 0.75, unit: "mm" },
    thickness: { type: "number", label: "Thickness", min: 0.8, max: 4, step: 0.1, default: 1.8, unit: "mm" },
    baseColor: { type: "color", label: "Base color", default: "#24b7ff" },
    accentColor: { type: "color", label: "Recursive color", default: "#ff9f43" }
  },
  animations: {
    recursionPulse: {
      label: "Recursion pulse",
      duration: 5.0,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("pathRadius", 0.75 + wave * 0.24);
        set("thickness", 1.8 + (wave * 0.5 + 0.5) * 0.9);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = params.size + params.pathRadius + 5;
    const z = params.thickness + 3;
    return [[-extent, -extent, -z], [extent, extent, z]];
  },
  render: ({ params }) => ({
    steps: 180,
    stepScale: 0.72,
    maxStep: Math.max(params.pathRadius * 3.5, 0.9),
    epsilon: Math.max(params.pathRadius * 0.014, 0.004),
    normalEpsilon: Math.max(params.pathRadius * 0.08, 0.03)
  }),
  glsl: GLSL
};
