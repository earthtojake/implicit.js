const GLSL = `
float sdf(vec3 p) {
  float field = implicit_tpms_schwarz(p, vec3(cellSize), vec3(1.0), 0.0) + fieldOffset;
  float shell = implicit_shell(field, wallThickness, 0.0);
  float cell = implicit_box_centered(p, vec3(cellSize), vec3(0.0));
  return max(shell, cell) * fieldScale;
}


vec3 color(vec3 p, vec3 normal) {
  float chamber = 0.5 + 0.5 * cos((p.x + p.y - p.z) * 0.085);
  return mix(baseColor, accentColor, chamber);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "Schwarz P unit cell",
  description: "Finite-thickness Schwarz P triply periodic shell clipped to one cubic unit cell.",
  units: "mm",
  params: {
    cellSize: { type: "number", label: "Cell size", min: 32, max: 72, step: 0.5, default: 48, unit: "mm" },
    wallThickness: { type: "number", label: "Wall thickness", min: 1.2, max: 7, step: 0.1, default: 3.5, unit: "mm" },
    fieldOffset: { type: "number", label: "Field offset", min: -0.8, max: 0.8, step: 0.02, default: 0 },
    fieldScale: { type: "number", label: "Field scale", min: 0.35, max: 0.9, step: 0.01, default: 0.52 },
    baseColor: { type: "color", label: "Chamber color", default: "#58a6ff" },
    accentColor: { type: "color", label: "Mint color", default: "#a7ffdf" }
  },
  animations: {
    chamberPulse: {
      label: "Chamber pulse",
      duration: 5.4,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("wallThickness", 3.5 + wave * 2.0);
        set("fieldOffset", wave * 0.45);
        set("fieldScale", 0.52 + wave * 0.16);
      }
    }
  },
  bounds: ({ params }) => {
    const half = params.cellSize / 2 + Math.max(params.wallThickness, 3);
    return [[-half, -half, -half], [half, half, half]];
  },
  render: ({ params }) => ({
    steps: 340,
    epsilon: Math.max(0.005, params.cellSize * 0.00014),
    normalEpsilon: Math.max(0.04, params.wallThickness * 0.014)
  }),
  glsl: GLSL
};
