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

vec3 peanoPoint(float i) {
  float row = floor(i / 9.0);
  float col = mod(i, 9.0);
  if (mod(row, 2.0) > 0.5) {
    col = 8.0 - col;
  }
  vec2 planar = (vec2(col, row) - vec2(4.0)) * spacing;
  float lift = sin((col * 2.0 + row) * 1.0471975512) * ripple;
  return vec3(planar, lift);
}

float sdf(vec3 p) {
  float d = 100000.0;
  for (int i = 0; i < 80; i += 1) {
    float fi = float(i);
    d = smoothMin(d, sdSegment(p, peanoPoint(fi), peanoPoint(fi + 1.0)), blendRadius);
  }
  return d - beamRadius;
}

vec3 color(vec3 p, vec3 normal) {
  float stripe = 0.5 + 0.5 * sin((p.x - p.y) * 0.26 + p.z * 0.45);
  vec3 c = mix(baseColor, accentColor, stripe);
  return c * (0.55 + 0.45 * smoothstep(-0.25, 0.9, normal.z));
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "Peano curve solid",
  description: "A dense Peano-inspired recursive subdivision path thickened into a rounded solid beam.",
  units: "mm",
  params: {
    spacing: { type: "number", label: "Subdivision spacing", min: 2.6, max: 6.5, step: 0.1, default: 4.2, unit: "mm" },
    beamRadius: { type: "number", label: "Beam radius", min: 0.35, max: 1.9, step: 0.05, default: 0.82, unit: "mm" },
    blendRadius: { type: "number", label: "Turn fillet", min: 0.1, max: 1.7, step: 0.05, default: 0.52, unit: "mm" },
    ripple: { type: "number", label: "Surface ripple", min: 0, max: 3, step: 0.05, default: 0.75, unit: "mm" },
    baseColor: { type: "color", label: "Base color", default: "#9b5cff" },
    accentColor: { type: "color", label: "Accent color", default: "#fff36b" }
  },
  animations: {
    subdivisionPulse: {
      label: "Subdivision pulse",
      duration: 4.8,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("beamRadius", 0.82 + wave * 0.2);
        set("ripple", 0.75 + (wave * 0.5 + 0.5) * 1.55);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = params.spacing * 4.45 + params.beamRadius + 4;
    const z = params.ripple + params.beamRadius + 4;
    return [[-extent, -extent, -z], [extent, extent, z]];
  },
  render: ({ params }) => ({
    steps: 220,
    stepScale: 0.62,
    maxStep: Math.max(params.beamRadius * 3.0, 0.9),
    epsilon: Math.max(params.beamRadius * 0.012, 0.004),
    normalEpsilon: Math.max(params.beamRadius * 0.075, 0.032)
  }),
  glsl: GLSL
};
