const GLSL = `
float sdSegment2(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h);
}

float hLevel(vec2 p, float s, vec2 o) {
  float d = sdSegment2(p, o + vec2(-s, 0.0), o + vec2(s, 0.0));
  d = min(d, sdSegment2(p, o + vec2(-s, -s * 0.5), o + vec2(-s, s * 0.5)));
  d = min(d, sdSegment2(p, o + vec2(s, -s * 0.5), o + vec2(s, s * 0.5)));
  return d;
}

float hTree(vec2 p) {
  float d = hLevel(p, size, vec2(0.0));
  if (levels > 1.5) {
    d = min(d, hLevel(p, size * 0.5, vec2(-size, size * 0.5)));
    d = min(d, hLevel(p, size * 0.5, vec2(size, size * 0.5)));
    d = min(d, hLevel(p, size * 0.5, vec2(-size, -size * 0.5)));
    d = min(d, hLevel(p, size * 0.5, vec2(size, -size * 0.5)));
  }
  if (levels > 2.5) {
    float s = size * 0.25;
    for (int ix = 0; ix < 4; ix += 1) {
      float fx = float(ix);
      vec2 o = vec2((mod(fx, 2.0) * 2.0 - 1.0) * size * 1.5, (floor(fx / 2.0) * 2.0 - 1.0) * size * 0.75);
      d = min(d, hLevel(p, s, o));
    }
  }
  return d;
}

float sdf(vec3 p) {
  float beam = hTree(p.xy) - beamRadius;
  float slab = abs(p.z) - thickness * 0.5;
  return max(beam, slab);
}

vec3 color(vec3 p, vec3 normal) {
  float branch = 0.5 + 0.5 * sin((abs(p.x) + abs(p.y)) * 0.13);
  vec3 c = mix(baseColor, accentColor, branch);
  return c * (0.58 + 0.42 * smoothstep(-0.2, 0.9, normal.z));
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "H-tree solid",
  description: "A recursive H-tree beam structure for branching structural CAD demos.",
  units: "mm",
  params: {
    size: { type: "number", label: "Branch size", min: 8, max: 24, step: 0.5, default: 15, unit: "mm" },
    levels: { type: "number", label: "Levels", min: 1, max: 3, step: 1, default: 3 },
    beamRadius: { type: "number", label: "Beam radius", min: 0.35, max: 2.2, step: 0.05, default: 0.95, unit: "mm" },
    thickness: { type: "number", label: "Thickness", min: 1, max: 5, step: 0.1, default: 2.4, unit: "mm" },
    baseColor: { type: "color", label: "Core color", default: "#60d5ff" },
    accentColor: { type: "color", label: "Branch color", default: "#b8ff7a" }
  },
  animations: {
    branchPulse: {
      label: "Branch pulse",
      duration: 4.6,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("beamRadius", 0.95 + wave * 0.28);
        set("thickness", 2.4 + (wave * 0.5 + 0.5) * 1.0);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = params.size * 1.95 + params.beamRadius + 4;
    const z = params.thickness + 3;
    return [[-extent, -extent, -z], [extent, extent, z]];
  },
  render: ({ params }) => ({
    steps: 170,
    stepScale: 0.72,
    maxStep: Math.max(params.beamRadius * 3.4, 0.9),
    epsilon: Math.max(params.beamRadius * 0.012, 0.004),
    normalEpsilon: Math.max(params.beamRadius * 0.08, 0.032)
  }),
  glsl: GLSL
};
