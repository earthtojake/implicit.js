const GLSL = `
float sdf(vec3 p) {
  vec3 q = implicit_rotate_axis(p, vec3(0.0), vec3(0.0, 0.0, 1.0), twistBlend * 0.45);
  float field = implicit_tpms_diamond(q, vec3(period), vec3(1.0), twistBlend);
  float shell = implicit_shell(field * period * 0.15, wallThickness, 0.0);
  float cube = implicit_box_centered(p, vec3(cellSize), vec3(0.0));
  return implicit_intersect_round(shell, cube, 1.35);
}

vec3 color(vec3 p, vec3 normal) {
  float diagonal = 0.5 + 0.5 * sin((p.x + p.y + p.z) / max(period, 0.1) * 6.2831853);
  float crossBand = 0.5 + 0.5 * sin((p.x - p.y + p.z * 0.65) / max(period, 0.1) * 6.2831853 + 1.7);
  float channel = smoothstep(0.48, 0.96, abs(dot(normal, normalize(vec3(1.0, -1.0, 1.0)))));
  vec3 gold = vec3(1.0, 0.88, 0.18);
  vec3 mint = vec3(0.18, 1.0, 0.72);
  vec3 body = mix(baseColor, accentColor, diagonal);
  body = mix(body, mint, crossBand * 0.34);
  body = mix(body, gold, channel * 0.52);
  return mix(body, vec3(1.0), 0.10 + channel * 0.08);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "schwarz d diamond cell",
  description: "Prompt 7: Schwarz diamond minimal surface with uniform wall thickness.",
  units: "mm",
  params: {
    cellSize: { type: "number", label: "Cell size", min: 30, max: 78, step: 1, default: 54, unit: "mm" },
    period: { type: "number", label: "Period", min: 12, max: 34, step: 0.5, default: 21, unit: "mm" },
    wallThickness: { type: "number", label: "Wall thickness", min: 0.8, max: 6, step: 0.1, default: 2.1, unit: "mm" },
    twistBlend: { type: "number", label: "Twist blend", min: 0, max: 1, step: 0.02, default: 0.08 },
    baseColor: { type: "color", label: "Diamond color", default: "#00d9ff" },
    accentColor: { type: "color", label: "Channel color", default: "#ff4fd8" }
  },
  animations: {
    diamondPhase: {
      label: "Diamond phase",
      duration: 6.2,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("twistBlend", 0.05 + (wave * 0.5 + 0.5) * 0.65);
        set("wallThickness", 1.6 + (1 - Math.abs(wave)) * 3.2);
      }
    }
  },
  bounds: [[-44, -44, -44], [44, 44, 44]],
  render: { steps: 300, epsilon: 0.005, normalEpsilon: 0.052 },
  glsl: GLSL
};
