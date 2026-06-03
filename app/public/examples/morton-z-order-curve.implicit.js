const GLSL = `
float sdSegment(vec3 p, vec3 a, vec3 b) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h);
}

float bitAt(float v, float place) {
  return mod(floor(v / place), 2.0);
}

vec2 mortonLayerPoint(float i) {
  float x = bitAt(i, 1.0) + bitAt(i, 4.0) * 2.0;
  float y = bitAt(i, 2.0) + bitAt(i, 8.0) * 2.0;
  return (vec2(x, y) - vec2(1.5)) * spacing;
}

float layerZ(float layer) {
  return (layer - 1.5) * spacing;
}

float layerPathDistance(vec3 p, float layer) {
  float z = layerZ(layer);
  float d = 100000.0;
  for (int i = 0; i < 15; i += 1) {
    float fi = float(i);
    d = min(d, sdSegment(p, vec3(mortonLayerPoint(fi), z), vec3(mortonLayerPoint(fi + 1.0), z)));
  }
  return d;
}

float sdf(vec3 p) {
  float d = 100000.0;
  for (int i = 0; i < 4; i += 1) {
    d = min(d, layerPathDistance(p, float(i)));
  }
  vec2 layerEnd = mortonLayerPoint(15.0);
  vec2 layerStart = mortonLayerPoint(0.0);
  for (int i = 0; i < 3; i += 1) {
    float layer = float(i);
    d = min(d, sdSegment(p, vec3(layerEnd, layerZ(layer)), vec3(layerStart, layerZ(layer + 1.0))));
  }
  return d - (beamRadius + cornerBlend * 0.12);
}

vec3 color(vec3 p, vec3 normal) {
  float codeBand = 0.5 + 0.5 * sin((p.x * 0.7 + p.y * 1.1 + p.z * 1.6) * 0.14);
  vec3 c = mix(baseColor, accentColor, codeBand);
  return c * (0.58 + 0.42 * pow(max(dot(normal, normalize(vec3(0.45, -0.36, 0.82))), 0.0), 1.8));
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "Morton Z-order curve",
  description: "A stepped 3D Z-order traversal through a 4x4x4 grid, thickened into a printable beam network.",
  units: "mm",
  params: {
    spacing: { type: "number", label: "Grid spacing", min: 4.5, max: 10.5, step: 0.1, default: 7.0, unit: "mm" },
    beamRadius: { type: "number", label: "Beam radius", min: 0.45, max: 2.4, step: 0.05, default: 1.05, unit: "mm" },
    cornerBlend: { type: "number", label: "Corner blend", min: 0.1, max: 2.2, step: 0.05, default: 0.62, unit: "mm" },
    baseColor: { type: "color", label: "Low bits", default: "#35e2ff" },
    accentColor: { type: "color", label: "High bits", default: "#c084fc" }
  },
  animations: {
    bitPulse: {
      label: "Bit pulse",
      duration: 5.5,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("spacing", 7.0 + wave * 1.25);
        set("beamRadius", 1.05 + (wave * 0.5 + 0.5) * 0.42);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = params.spacing * 2.05 + params.beamRadius + params.cornerBlend + 5;
    return [[-extent, -extent, -extent], [extent, extent, extent]];
  },
  render: ({ params }) => ({
    steps: 108,
    stepScale: 0.78,
    maxStep: Math.max(params.beamRadius * 4.2, 1.6),
    epsilon: Math.max(params.beamRadius * 0.018, 0.008),
    normalEpsilon: Math.max(params.beamRadius * 0.09, 0.045)
  }),
  glsl: GLSL
};
