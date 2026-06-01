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

vec3 gosperPoint(float i) {
  float t = i / 60.0;
  float angle = t * 6.28318530718 * 3.0 + sin(t * 6.28318530718 * 7.0) * 0.26;
  float hex = floor(mod(i, 6.0));
  float r = size * (0.25 + 0.55 * t + 0.12 * sin(t * 18.8495559));
  vec2 q = vec2(cos(angle), sin(angle)) * r;
  q += vec2(cos(hex * 1.0471975512), sin(hex * 1.0471975512)) * cellJitter;
  return vec3(q, sin(t * 12.566370614) * verticalLift);
}

float sdf(vec3 p) {
  float d = 100000.0;
  for (int i = 0; i < 60; i += 1) {
    float fi = float(i);
    d = smoothMin(d, sdSegment(p, gosperPoint(fi), gosperPoint(fi + 1.0)), bendBlend);
  }
  return d - tubeRadius;
}

vec3 color(vec3 p, vec3 normal) {
  float hexBand = 0.5 + 0.5 * sin(atan(p.y, p.x) * 6.0 + length(p.xy) * 0.16);
  vec3 c = mix(baseColor, accentColor, hexBand);
  return c * (0.56 + 0.44 * smoothstep(-0.25, 0.95, normal.z));
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "Gosper curve tube",
  description: "A hexagonal Gosper-flow inspired tube with smooth recursive-looking bends.",
  units: "mm",
  params: {
    size: { type: "number", label: "Flow size", min: 14, max: 38, step: 0.5, default: 27, unit: "mm" },
    tubeRadius: { type: "number", label: "Tube radius", min: 0.45, max: 2.6, step: 0.05, default: 1.12, unit: "mm" },
    bendBlend: { type: "number", label: "Bend blend", min: 0.1, max: 2.4, step: 0.05, default: 0.82, unit: "mm" },
    cellJitter: { type: "number", label: "Hex offset", min: 0, max: 5, step: 0.1, default: 2.2, unit: "mm" },
    verticalLift: { type: "number", label: "Vertical lift", min: 0, max: 8, step: 0.1, default: 2.4, unit: "mm" },
    baseColor: { type: "color", label: "Base color", default: "#24e6c2" },
    accentColor: { type: "color", label: "Accent color", default: "#fff45a" }
  },
  animations: {
    hexFlow: {
      label: "Hex flow",
      duration: 6.2,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("cellJitter", 2.2 + wave * 1.4);
        set("verticalLift", 2.4 + (wave * 0.5 + 0.5) * 3.6);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = params.size + params.cellJitter + params.tubeRadius + 6;
    const z = params.verticalLift + params.tubeRadius + 5;
    return [[-extent, -extent, -z], [extent, extent, z]];
  },
  render: ({ params }) => ({
    steps: 220,
    stepScale: 0.64,
    maxStep: Math.max(params.tubeRadius * 3.2, 1.0),
    epsilon: Math.max(params.tubeRadius * 0.012, 0.004),
    normalEpsilon: Math.max(params.tubeRadius * 0.075, 0.034)
  }),
  glsl: GLSL
};
