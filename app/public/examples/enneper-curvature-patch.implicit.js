const GLSL = `
float sdf(vec3 p) {
  float r = length(p.xy);
  float x = p.x / max(saddleScale, 0.1);
  float y = p.y / max(saddleScale, 0.1);
  float enneperHeight = saddleScale * 0.42 * (x * x - y * y) * (1.0 - 0.18 * (x * x + y * y));
  enneperHeight += ripple * sin(atan(p.y, p.x) * 3.0) * smoothstep(radius, 0.0, r);
  float sheet = abs(p.z - enneperHeight) - thickness;
  float disk = r - radius;
  return implicit_intersect_round(sheet, disk, thickness * 1.25);
}

vec3 color(vec3 p, vec3 normal) {
  float contour = smoothstep(0.42, 0.5, abs(fract((p.z + length(p.xy) * 0.12) / 4.0) - 0.5));
  float curve = smoothstep(0.0, 0.95, abs(normal.z));
  return mix(mix(baseColor * 0.62, baseColor, curve), accentColor, contour * 0.62);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "enneper curvature patch",
  description: "Prompt 14: thickened Enneper-inspired minimal surface with contour coloring.",
  units: "mm",
  params: {
    radius: { type: "number", label: "Patch radius", min: 16, max: 42, step: 0.25, default: 30, unit: "mm" },
    saddleScale: { type: "number", label: "Saddle scale", min: 12, max: 42, step: 0.5, default: 24, unit: "mm" },
    ripple: { type: "number", label: "Contour ripple", min: 0, max: 5, step: 0.1, default: 1.8, unit: "mm" },
    thickness: { type: "number", label: "Thickness", min: 0.6, max: 5, step: 0.1, default: 1.8, unit: "mm" },
    baseColor: { type: "color", label: "Curvature color", default: "#ff8a3d" },
    accentColor: { type: "color", label: "Contour color", default: "#7c5cff" }
  },
  animations: {
    curvatureTide: {
      label: "Curvature tide",
      duration: 5.7,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("saddleScale", 21 + wave * 8);
        set("ripple", (wave * 0.5 + 0.5) * 4.5);
      }
    }
  },
  bounds: [[-46, -46, -34], [46, 46, 34]],
  render: { steps: 288, epsilon: 0.004, normalEpsilon: 0.046 },
  glsl: GLSL
};
