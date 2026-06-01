const GLSL = `
float sdSegment(vec3 p, vec3 a, vec3 b) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h);
}

float smoothMin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / max(k, 0.0001), 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

vec3 moorePoint(float i) {
  float row = floor(i / 6.0);
  float col = mod(i, 6.0);
  if (mod(row, 2.0) > 0.5) {
    col = 5.0 - col;
  }
  vec2 planar = (vec2(col, row) - vec2(2.5)) * spacing;
  float z = sin(i * 1.57079632679) * verticalWave;
  return vec3(planar, z);
}

float sdf(vec3 p) {
  float d = 100000.0;
  for (int i = 0; i < 35; i += 1) {
    float fi = float(i);
    d = smoothMin(d, sdSegment(p, moorePoint(fi), moorePoint(fi + 1.0)), bendBlend);
  }
  d = smoothMin(d, sdSegment(p, moorePoint(35.0), moorePoint(0.0)), bendBlend);
  return d - tubeRadius;
}

vec3 color(vec3 p, vec3 normal) {
  float ring = atan(p.y, p.x) * 0.15915494309 + length(p.xy) * 0.018;
  float band = 0.5 + 0.5 * sin(ring * 6.28318530718 + p.z * 0.25);
  vec3 c = mix(baseColor, accentColor, band);
  return c * (0.58 + 0.42 * smoothstep(-0.4, 0.9, normal.z));
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "Moore curve loop",
  description: "A closed Moore space-filling loop rendered as a continuous rounded tube.",
  units: "mm",
  params: {
    spacing: { type: "number", label: "Cell spacing", min: 4, max: 9, step: 0.1, default: 6.2, unit: "mm" },
    tubeRadius: { type: "number", label: "Tube radius", min: 0.4, max: 2.5, step: 0.05, default: 1.05, unit: "mm" },
    bendBlend: { type: "number", label: "Bend blend", min: 0.1, max: 2.4, step: 0.05, default: 0.72, unit: "mm" },
    verticalWave: { type: "number", label: "Vertical wave", min: 0, max: 5, step: 0.1, default: 1.4, unit: "mm" },
    baseColor: { type: "color", label: "Cool color", default: "#38d9ff" },
    accentColor: { type: "color", label: "Hot color", default: "#ff7ab6" }
  },
  animations: {
    loopWave: {
      label: "Loop wave",
      duration: 5.2,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("verticalWave", 1.4 + (wave * 0.5 + 0.5) * 3.2);
        set("tubeRadius", 1.05 + wave * 0.26);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = params.spacing * 3.2 + params.tubeRadius + 5;
    const z = params.verticalWave + params.tubeRadius + 5;
    return [[-extent, -extent, -z], [extent, extent, z]];
  },
  render: ({ params }) => ({
    steps: 210,
    stepScale: 0.66,
    maxStep: Math.max(params.tubeRadius * 3.4, 1.2),
    epsilon: Math.max(params.tubeRadius * 0.013, 0.005),
    normalEpsilon: Math.max(params.tubeRadius * 0.075, 0.035)
  }),
  glsl: GLSL
};
