const GLSL = `
const float IMPLICIT_MOBIUS_TAU = 6.283185307179586;

float sdf(vec3 p) {
  float u = atan(p.y, p.x);
  vec2 section = vec2(length(p.xy) - radius, p.z);
  vec2 twistAxis = vec2(cos(0.5 * u), sin(0.5 * u));
  vec2 closest = twistAxis * clamp(dot(section, twistAxis), -(width * 0.5), (width * 0.5));
  return length(section - closest) - thickness;
}


vec3 implicit_palette(float t) {
  float waveA = 0.5 + 0.5 * cos(6.283185307179586 * (t + 0.1));
  float waveB = 0.5 + 0.5 * cos(6.283185307179586 * (t + 0.56));
  return mix(mix(baseColor, midColor, waveA), accentColor, waveB * 0.74);
}

vec3 color(vec3 p, vec3 normal) {
  vec2 ring = vec2(p.x, p.y);
  float angle = atan(ring.y, ring.x) / 6.283185307179586;
  vec3 bandColor = implicit_palette(angle + p.z * 0.035);
  return mix(bandColor, edgeColor, smoothstep(0.25, 0.95, abs(normal.z)) * 0.28);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "thickened Mobius strip",
  description: "A manufacturable one-half-twist Mobius strip with rounded boundary and finite shell thickness.",
  units: "mm",
  params: {
    radius: { type: "number", label: "Radius", min: 14, max: 34, step: 0.25, default: 24, unit: "mm" },
    width: { type: "number", label: "Band width", min: 4, max: 22, step: 0.25, default: 13.6, unit: "mm" },
    thickness: { type: "number", label: "Thickness", min: 0.25, max: 2.5, step: 0.05, default: 0.82, unit: "mm" },
    baseColor: { type: "color", label: "Rose color", default: "#ff4fa3" },
    midColor: { type: "color", label: "Lagoon color", default: "#7c5cff" },
    accentColor: { type: "color", label: "Iris color", default: "#35e6c9" },
    edgeColor: { type: "color", label: "Edge color", default: "#ffd166" }
  },
  animations: {
    bandBreath: {
      label: "Band breath",
      duration: 4.8,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("width", 13.6 + wave * 5.5);
        set("thickness", 0.82 + wave * 0.35);
        set("radius", 24 + wave * 4);
      }
    }
  },
  bounds: ({ params }) => {
    const halfWidth = params.width * 0.5;
    const radialExtent = params.radius + halfWidth + params.thickness + 6;
    const heightExtent = halfWidth + params.thickness + 6;
    return [[-radialExtent, -radialExtent, -heightExtent], [radialExtent, radialExtent, heightExtent]];
  },
  render: ({ params }) => ({
    steps: 192,
    stepScale: 0.72,
    maxStep: Math.max(params.thickness * 3.8, 1.4),
    epsilon: Math.max(params.thickness * 0.012, 0.006),
    normalEpsilon: Math.max(params.thickness * 0.075, 0.04)
  }),
  glsl: GLSL
};
