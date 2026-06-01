const GLSL = `
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float branchBox(vec3 p, vec2 center, vec2 halfSize, float zCenter) {
  return sdBox(p - vec3(center, zCenter), vec3(halfSize, thickness * 0.5));
}

float sdf(vec3 p) {
  float d = branchBox(p, vec2(0.0, -size * 0.25), vec2(size * 0.55, size * 0.32), 0.0);
  d = min(d, branchBox(p, vec2(-size * 0.36, size * 0.34), vec2(size * 0.36, size * 0.24), thickness * 0.04));
  d = min(d, branchBox(p, vec2(size * 0.36, size * 0.34), vec2(size * 0.36, size * 0.24), thickness * 0.04));
  if (levels > 1.5) {
    d = min(d, branchBox(p, vec2(-size * 0.72, size * 0.86), vec2(size * 0.24, size * 0.18), thickness * 0.1));
    d = min(d, branchBox(p, vec2(-size * 0.16, size * 0.92), vec2(size * 0.22, size * 0.17), thickness * 0.1));
    d = min(d, branchBox(p, vec2(size * 0.16, size * 0.92), vec2(size * 0.22, size * 0.17), thickness * 0.1));
    d = min(d, branchBox(p, vec2(size * 0.72, size * 0.86), vec2(size * 0.24, size * 0.18), thickness * 0.1));
  }
  if (levels > 2.5) {
    d = min(d, branchBox(p, vec2(-size * 0.95, size * 1.22), vec2(size * 0.16, size * 0.12), thickness * 0.16));
    d = min(d, branchBox(p, vec2(-size * 0.52, size * 1.32), vec2(size * 0.14, size * 0.11), thickness * 0.16));
    d = min(d, branchBox(p, vec2(0.0, size * 1.38), vec2(size * 0.14, size * 0.11), thickness * 0.16));
    d = min(d, branchBox(p, vec2(size * 0.52, size * 1.32), vec2(size * 0.14, size * 0.11), thickness * 0.16));
    d = min(d, branchBox(p, vec2(size * 0.95, size * 1.22), vec2(size * 0.16, size * 0.12), thickness * 0.16));
  }
  return d - cornerRound;
}

vec3 color(vec3 p, vec3 normal) {
  float leaf = smoothstep(size * 0.35, size * 1.35, p.y);
  vec3 c = mix(baseColor, accentColor, leaf);
  return c * (0.58 + 0.42 * smoothstep(-0.1, 0.9, normal.z));
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "Pythagoras tree solid",
  description: "A stable 3D Pythagoras tree made from recursively arranged softened blocks.",
  units: "mm",
  params: {
    size: { type: "number", label: "Base size", min: 8, max: 22, step: 0.5, default: 14, unit: "mm" },
    levels: { type: "number", label: "Levels", min: 1, max: 3, step: 1, default: 3 },
    thickness: { type: "number", label: "Thickness", min: 1.5, max: 7, step: 0.1, default: 3.0, unit: "mm" },
    cornerRound: { type: "number", label: "Corner round", min: 0.05, max: 1.2, step: 0.05, default: 0.35, unit: "mm" },
    baseColor: { type: "color", label: "Trunk color", default: "#ff9f1c" },
    accentColor: { type: "color", label: "Canopy color", default: "#65f58a" }
  },
  animations: {
    canopySway: {
      label: "Canopy sway",
      duration: 5.8,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("cornerRound", 0.35 + (wave * 0.5 + 0.5) * 0.55);
        set("thickness", 3.0 + wave * 0.7);
      }
    }
  },
  bounds: ({ params }) => {
    const x = params.size * 1.25 + 6;
    const y = params.size * 1.65 + 6;
    const z = params.thickness + params.cornerRound + 4;
    return [[-x, -params.size - 4, -z], [x, y, z]];
  },
  render: ({ params }) => ({
    steps: 180,
    stepScale: 0.72,
    maxStep: Math.max(params.cornerRound * 5, 1.0),
    epsilon: Math.max(params.cornerRound * 0.012, 0.004),
    normalEpsilon: Math.max(params.cornerRound * 0.12, 0.035)
  }),
  glsl: GLSL
};
