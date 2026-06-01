const GLSL = `
float t4(float x) {
  float x2 = x * x;
  return 8.0 * x2 * x2 - 8.0 * x2 + 1.0;
}

float t5(float x) {
  float x2 = x * x;
  return 16.0 * x2 * x2 * x - 20.0 * x2 * x + 5.0 * x;
}

float sdf(vec3 p) {
  vec3 q = p / max(radius * 0.52, 0.1) * polynomialScale;
  float f4 = t4(q.x) + t4(q.y) + t4(q.z);
  float f5 = t5(q.x) + t5(q.y) + t5(q.z);
  float field = mix(f4, f5, orderMix) + mix(-0.55, 0.12, orderMix);
  float shell = abs(field) * radius * 0.055 - thickness;
  float clip = implicit_sphere(p, vec3(0.0), radius);
  return implicit_intersect_round(shell, clip, 1.0);
}

vec3 color(vec3 p, vec3 normal) {
  float nodes = 0.5 + 0.5 * sin((p.x * p.y + p.y * p.z + p.z * p.x) * 0.012);
  float saddle = smoothstep(0.15, 0.95, abs(normal.x * normal.y * normal.z) * 6.0);
  return mix(mix(baseColor * 0.62, baseColor, nodes), accentColor, saddle * 0.58);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "chmutov node field",
  description: "Prompt 18: Chmutov-style high-order algebraic surface with many nodes.",
  units: "mm",
  params: {
    radius: { type: "number", label: "Clip radius", min: 22, max: 52, step: 0.5, default: 38, unit: "mm" },
    polynomialScale: { type: "number", label: "Polynomial scale", min: 0.6, max: 1.6, step: 0.02, default: 1.05 },
    orderMix: { type: "number", label: "Order mix", min: 0, max: 1, step: 0.02, default: 0.35 },
    thickness: { type: "number", label: "Thickness", min: 0.2, max: 3, step: 0.05, default: 0.9, unit: "mm" },
    baseColor: { type: "color", label: "Node color", default: "#38bdf8" },
    accentColor: { type: "color", label: "Saddle color", default: "#ff8a3d" }
  },
  animations: {
    orderDrift: {
      label: "Order drift",
      duration: 7,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("orderMix", wave * 0.5 + 0.5);
        set("polynomialScale", 0.92 + (1 - Math.abs(wave)) * 0.46);
      }
    }
  },
  bounds: [[-56, -56, -56], [56, 56, 56]],
  render: { steps: 356, epsilon: 0.005, normalEpsilon: 0.055 },
  glsl: GLSL
};
