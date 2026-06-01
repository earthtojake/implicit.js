const GLSL = `
float sdf(vec3 p) {
  float field = implicit_tpms_neovius(p, vec3(period), vec3(1.0), schwarzBlend);
  float shell = implicit_shell(field * period * 0.13, wallThickness, 0.0);
  float cube = implicit_box_centered(p, vec3(cellSize), vec3(0.0));
  return implicit_intersect_round(shell, cube, 1.5);
}

vec3 color(vec3 p, vec3 normal) {
  vec3 folded = abs(implicit_repeat_centered(p, vec3(period)));
  float node = smoothstep(period * 0.18, period * 0.48, length(folded));
  float glow = pow(max(dot(normal, normalize(vec3(0.35, -0.4, 0.84))), 0.0), 2.0);
  return mix(baseColor * (0.68 + 0.32 * glow), accentColor, node * 0.72);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "neovius porosity cell",
  description: "Prompt 8: Neovius periodic implicit surface with complex internal channels.",
  units: "mm",
  params: {
    cellSize: { type: "number", label: "Cell size", min: 30, max: 80, step: 1, default: 56, unit: "mm" },
    period: { type: "number", label: "Period", min: 14, max: 36, step: 0.5, default: 23, unit: "mm" },
    wallThickness: { type: "number", label: "Wall thickness", min: 0.8, max: 6, step: 0.1, default: 2.3, unit: "mm" },
    schwarzBlend: { type: "number", label: "Schwarz blend", min: 0, max: 1, step: 0.02, default: 0.22 },
    baseColor: { type: "color", label: "Channel color", default: "#20e6b8" },
    accentColor: { type: "color", label: "Node color", default: "#ffe45c" }
  },
  animations: {
    channelBloom: {
      label: "Channel bloom",
      duration: 6.4,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("wallThickness", 1.4 + (wave * 0.5 + 0.5) * 4.2);
        set("schwarzBlend", 0.08 + (1 - Math.abs(wave)) * 0.74);
      }
    }
  },
  bounds: [[-46, -46, -46], [46, 46, 46]],
  render: { steps: 316, epsilon: 0.005, normalEpsilon: 0.055 },
  glsl: GLSL
};
