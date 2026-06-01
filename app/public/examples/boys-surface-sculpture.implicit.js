const GLSL = `
float sdf(vec3 p) {
  float r = length(p);
  float theta = atan(p.y, p.x);
  float phi = atan(p.z, length(p.xy));
  float triLobe = sin(3.0 * theta) * cos(phi * 2.0) + 0.45 * cos(3.0 * phi);
  float shellRadius = radius + lobeDepth * triLobe;
  float shell = abs(r - shellRadius) - thickness;
  float selfFold = implicit_capsule(p, vec3(-radius * 0.55, 0.0, -radius * 0.3), vec3(radius * 0.55, 0.0, radius * 0.3), thickness * (2.2 + pinch));
  float pinchCut = implicit_torus(vec3(p.x, p.z, p.y), radius * 0.46, thickness * (1.1 + pinch));
  return implicit_union_round(implicit_intersect_round(shell, -pinchCut, thickness), selfFold, thickness * 1.4);
}

vec3 color(vec3 p, vec3 normal) {
  float fold = smoothstep(0.25, 0.95, abs(normal.x * 1.2 + normal.y * 0.4));
  float tri = 0.5 + 0.5 * sin(atan(p.y, p.x) * 3.0 + p.z * 0.08);
  return mix(mix(baseColor * 0.65, baseColor, tri), accentColor, fold * 0.52);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "boys surface sculpture",
  description: "Prompt 15: compact non-orientable Boy's-surface-inspired implicit sculpture.",
  units: "mm",
  params: {
    radius: { type: "number", label: "Radius", min: 18, max: 42, step: 0.25, default: 30, unit: "mm" },
    lobeDepth: { type: "number", label: "Lobe depth", min: 1, max: 12, step: 0.25, default: 6.5, unit: "mm" },
    pinch: { type: "number", label: "Pinch", min: 0, max: 1, step: 0.02, default: 0.44 },
    thickness: { type: "number", label: "Shell thickness", min: 0.8, max: 6, step: 0.1, default: 2.4, unit: "mm" },
    baseColor: { type: "color", label: "Surface color", default: "#a78bfa" },
    accentColor: { type: "color", label: "Fold color", default: "#ffb86b" }
  },
  animations: {
    lobeTurn: {
      label: "Lobe turn",
      duration: 6.8,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("lobeDepth", 4 + (wave * 0.5 + 0.5) * 8);
        set("pinch", 0.22 + (1 - Math.abs(wave)) * 0.58);
      }
    }
  },
  bounds: [[-48, -48, -48], [48, 48, 48]],
  render: { steps: 310, epsilon: 0.0045, normalEpsilon: 0.048 },
  glsl: GLSL
};
