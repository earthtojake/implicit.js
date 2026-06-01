const GLSL = `
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float snowflakeRadius(float a) {
  float r = radius * (0.72 + 0.12 * cos(3.0 * a));
  if (depth > 1.5) {
    r += radius * 0.105 * cos(12.0 * a);
  }
  if (depth > 2.5) {
    r += radius * 0.055 * cos(48.0 * a);
  }
  if (depth > 3.5) {
    r += radius * 0.026 * cos(96.0 * a);
  }
  return r;
}

float sdf(vec3 p) {
  float a = atan(p.y, p.x);
  float radial = length(p.xy) - snowflakeRadius(a);
  float sideBevel = radial - edgeRound;
  float slab = abs(p.z) - thickness * 0.5 + edgeRound;
  return min(max(sideBevel, slab), 0.0) + length(max(vec2(sideBevel, slab), 0.0)) - edgeRound;
}

vec3 color(vec3 p, vec3 normal) {
  float a = atan(p.y, p.x);
  float ice = 0.5 + 0.5 * cos(a * 12.0 + length(p.xy) * 0.11);
  vec3 c = mix(baseColor, accentColor, ice);
  return c * (0.62 + 0.38 * smoothstep(-0.3, 0.95, normal.z));
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "Koch snowflake extrusion",
  description: "A rounded extruded Koch-snowflake approximation with controllable recursive edge detail.",
  units: "mm",
  params: {
    radius: { type: "number", label: "Radius", min: 14, max: 42, step: 0.5, default: 28, unit: "mm" },
    depth: { type: "number", label: "Recursion depth", min: 1, max: 4, step: 1, default: 4 },
    thickness: { type: "number", label: "Thickness", min: 1.5, max: 9, step: 0.1, default: 4.2, unit: "mm" },
    edgeRound: { type: "number", label: "Edge round", min: 0.05, max: 1.6, step: 0.05, default: 0.55, unit: "mm" },
    baseColor: { type: "color", label: "Ice color", default: "#e0fbff" },
    accentColor: { type: "color", label: "Edge color", default: "#00a6ff" }
  },
  animations: {
    frostBloom: {
      label: "Frost bloom",
      duration: 5.0,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("edgeRound", 0.55 + (wave * 0.5 + 0.5) * 0.75);
        set("thickness", 4.2 + wave * 1.2);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = params.radius + params.edgeRound + 7;
    const z = params.thickness + params.edgeRound + 4;
    return [[-extent, -extent, -z], [extent, extent, z]];
  },
  render: ({ params }) => ({
    steps: 180,
    stepScale: 0.72,
    maxStep: Math.max(params.edgeRound * 4.5, 1.0),
    epsilon: Math.max(params.edgeRound * 0.012, 0.004),
    normalEpsilon: Math.max(params.edgeRound * 0.09, 0.035)
  }),
  glsl: GLSL
};
