const GLSL = `
float sdf(vec3 p) {
  float theta = atan(p.y, p.x);
  float r = length(p.xy);
  float periodZ = max(pitch, 0.1);
  float phase = p.z - theta / 6.2831853 * periodZ;
  phase = mod(phase + periodZ * 0.5, periodZ) - periodZ * 0.5;
  float sheet = abs(phase) - thickness;
  float radialBand = abs(r - radius) - ribbonWidth * 0.5;
  float ribbon = max(sheet, radialBand);
  float zClip = abs(p.z) - height * 0.5;
  float hub = implicit_cylinder_capped(p, vec3(0.0, 0.0, -height * 0.52), vec3(0.0, 0.0, height * 0.52), thickness * 1.15);
  return implicit_union_round(max(ribbon, zClip), hub, thickness * 0.8);
}

vec3 color(vec3 p, vec3 normal) {
  float helix = fract((atan(p.y, p.x) / 6.2831853) + p.z / max(pitch, 0.1));
  float edge = smoothstep(ribbonWidth * 0.36, ribbonWidth * 0.55, abs(length(p.xy) - radius));
  vec3 body = mix(baseColor * 0.65, baseColor, helix);
  return mix(body, accentColor, edge * 0.75);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "helicoid printable ribbon",
  description: "Prompt 10: adjustable helicoid thickened into a printable screw-like ribbon.",
  units: "mm",
  params: {
    radius: { type: "number", label: "Radius", min: 14, max: 38, step: 0.25, default: 26, unit: "mm" },
    pitch: { type: "number", label: "Pitch", min: 14, max: 48, step: 0.5, default: 28, unit: "mm" },
    height: { type: "number", label: "Height", min: 24, max: 82, step: 1, default: 58, unit: "mm" },
    ribbonWidth: { type: "number", label: "Ribbon width", min: 5, max: 24, step: 0.25, default: 13, unit: "mm" },
    thickness: { type: "number", label: "Thickness", min: 0.8, max: 6, step: 0.1, default: 2.3, unit: "mm" },
    baseColor: { type: "color", label: "Ribbon color", default: "#c77dff" },
    accentColor: { type: "color", label: "Edge color", default: "#35f0ff" }
  },
  animations: {
    pitchSweep: {
      label: "Pitch sweep",
      duration: 6,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("pitch", 24 + wave * 12);
        set("ribbonWidth", 10 + (1 - Math.abs(wave)) * 10);
      }
    }
  },
  bounds: [[-44, -44, -48], [44, 44, 48]],
  render: { steps: 280, epsilon: 0.004, normalEpsilon: 0.045 },
  glsl: GLSL
};
