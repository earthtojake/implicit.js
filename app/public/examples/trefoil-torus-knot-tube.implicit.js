const GLSL = `
const float IMPLICIT_TREFOIL_TAU = 6.283185307179586;

float sdf(vec3 p) {
  p.z /= verticalScale;
  float phi = atan(p.y, p.x);
  vec2 torusSection = vec2(length(p.xy) - majorRadius, p.z);
  float best = 1.0e6;
  for (int branchIndex = 0; branchIndex < 3; branchIndex += 1) {
    float t = (phi + IMPLICIT_TREFOIL_TAU * float(branchIndex)) / 3.0;
    vec2 knotCenter = knotRadius * vec2(cos(2.0 * t), sin(2.0 * t));
    best = min(best, length(torusSection - knotCenter));
  }
  return best - tubeRadius;
}


vec3 color(vec3 p, vec3 normal) {
  float sweep = atan(p.y, p.x) / IMPLICIT_TREFOIL_TAU + p.z * 0.018;
  return mix(baseColor, accentColor, 0.5 + 0.5 * sin(6.283185307179586 * sweep));
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "trefoil torus-knot tube",
  description: "A constant-radius solid tube following a closed trefoil torus knot path.",
  units: "mm",
  params: {
    majorRadius: { type: "number", label: "Major radius", min: 10, max: 24, step: 0.25, default: 16.5, unit: "mm" },
    knotRadius: { type: "number", label: "Lobe radius", min: 3.5, max: 10, step: 0.1, default: 6.9, unit: "mm" },
    tubeRadius: { type: "number", label: "Tube radius", min: 0.8, max: 4.5, step: 0.05, default: 2.05, unit: "mm" },
    verticalScale: { type: "number", label: "Vertical scale", min: 0.65, max: 1.6, step: 0.05, default: 1 },
    baseColor: { type: "color", label: "Copper color", default: "#ff7a33" },
    accentColor: { type: "color", label: "Cyan color", default: "#2ee8ff" }
  },
  animations: {
    knotBreath: {
      label: "Knot breath",
      duration: 5.2,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("tubeRadius", 2.05 + wave * 0.95);
        set("knotRadius", 6.9 + wave * 1.7);
        set("verticalScale", 1 + wave * 0.3);
      }
    }
  },
  bounds: ({ params }) => {
    const xy = params.majorRadius + params.knotRadius + params.tubeRadius + 5;
    const z = params.knotRadius * params.verticalScale + params.tubeRadius + 5;
    return [[-xy, -xy, -z], [xy, xy, z]];
  },
  render: ({ params }) => ({
    steps: 220,
    epsilon: Math.max(0.006, params.tubeRadius * 0.004),
    normalEpsilon: Math.max(0.04, params.tubeRadius * 0.028),
    stepScale: 0.72,
    maxStep: Math.max(params.tubeRadius * 0.68, 0.7)
  }),
  glsl: GLSL
};
