const GLSL = `
float sdf(vec3 p) {
  vec3 q = p / scale;
  float field = q.x * q.x - q.y * q.y * q.z;
  float gradientScale = pinchSharpness + length(vec3(2.0 * q.x, -2.0 * q.y * q.z, -q.y * q.y));
  float sheet = abs(field) / gradientScale * scale - thickness;
  float clip = implicit_sphere(p, vec3(0.0), clipRadius);
  return max(sheet, clip) * 0.28;
}


vec3 color(vec3 p, vec3 normal) {
  float pinch = 1.0 - smoothstep(0.0, 12.0, length(p.xy));
  return mix(mix(sheetLowColor, sheetHighColor, smoothstep(-14.0, 16.0, p.z)), pinchColor, pinch * 0.65);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "Whitney umbrella bounded thickness",
  description: "A sphere-clipped thickened Whitney umbrella retaining the pinch and self-intersecting sheet structure.",
  units: "mm",
  params: {
    scale: { type: "number", label: "Field scale", min: 8, max: 20, step: 0.25, default: 13.5, unit: "mm" },
    thickness: { type: "number", label: "Thickness", min: 0.25, max: 2.2, step: 0.05, default: 0.95, unit: "mm" },
    clipRadius: { type: "number", label: "Clip radius", min: 16, max: 36, step: 0.5, default: 27, unit: "mm" },
    pinchSharpness: { type: "number", label: "Pinch sharpness", min: 0.25, max: 0.9, step: 0.01, default: 0.45 },
    sheetLowColor: { type: "color", label: "Lower sheet", default: "#8b5cf6" },
    sheetHighColor: { type: "color", label: "Upper sheet", default: "#38dff8" },
    pinchColor: { type: "color", label: "Pinch color", default: "#ff6fb1" }
  },
  animations: {
    pinchPulse: {
      label: "Pinch pulse",
      duration: 4.8,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("thickness", 0.95 + wave * 0.55);
        set("pinchSharpness", 0.45 + wave * 0.18);
        set("clipRadius", 27 + wave * 6);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = params.clipRadius + Math.max(params.thickness, 1) + 3;
    return [[-extent, -extent, -extent], [extent, extent, extent]];
  },
  render: ({ params }) => ({
    steps: 520,
    epsilon: Math.max(0.005, params.thickness * 0.009),
    normalEpsilon: Math.max(0.045, params.thickness * 0.055)
  }),
  glsl: GLSL
};
