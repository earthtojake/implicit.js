const GLSL = `
float sdf(vec3 p) {
  float body = implicit_sphere(p, vec3(0.0), radius);
  float d = body;
  if (sliceEnabled) {
    float belowSlice = p.z - sliceHeight;
    d = implicit_intersect_round(d, belowSlice, bevel);
  }
  if (boreEnabled && boreRadius > 0.01) {
    float bore = implicit_cylinder_capped(
      p,
      vec3(-radius * 1.15, 0.0, 0.0),
      vec3(radius * 1.15, 0.0, 0.0),
      boreRadius
    );
    d = implicit_intersect_round(d, -bore, max(bevel * 0.65, 0.25));
  }
  return d;
}

vec3 color(vec3 p, vec3 normal) {
  float cap = sliceEnabled ? smoothstep(sliceHeight - 3.5, sliceHeight + 0.75, p.z) : 0.0;
  float bore = boreEnabled ? smoothstep(0.78, 0.98, abs(normal.x)) * (1.0 - smoothstep(boreRadius + 2.0, boreRadius + 9.0, length(p.yz))) : 0.0;
  float latitude = 0.5 + 0.5 * normal.z;
  vec3 body = mix(baseColor * 0.55, baseColor, latitude);
  body += vec3(0.08, 0.10, 0.12) * pow(max(dot(normal, normalize(vec3(-0.45, 0.35, 0.82))), 0.0), 3.0);
  return mix(body, accentColor, clamp(max(cap, bore) * 0.9, 0.0, 1.0));
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "sphere boolean cuts",
  description: "Prompt 1: clean implicit sphere with smooth normals and optional boolean cuts.",
  units: "mm",
  params: {
    radius: { type: "number", label: "Radius", min: 14, max: 44, step: 0.25, default: 28, unit: "mm" },
    sliceHeight: { type: "number", label: "Slice height", min: -10, max: 22, step: 0.25, default: 11, unit: "mm" },
    boreRadius: { type: "number", label: "Bore radius", min: 0, max: 14, step: 0.25, default: 7, unit: "mm" },
    bevel: { type: "number", label: "Cut bevel", min: 0.2, max: 5, step: 0.1, default: 2.4, unit: "mm" },
    sliceEnabled: { type: "boolean", label: "Slice cut", default: true },
    boreEnabled: { type: "boolean", label: "Bore cut", default: true },
    baseColor: { type: "color", label: "Base color", default: "#34d5ff" },
    accentColor: { type: "color", label: "Cut accent", default: "#ffd166" }
  },
  animations: {
    revealCuts: {
      label: "Reveal cuts",
      duration: 4.8,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("sliceHeight", 5 + wave * 13);
        set("boreRadius", 4 + (wave * 0.5 + 0.5) * 8);
        set("bevel", 1.2 + (wave * 0.5 + 0.5) * 2.8);
      }
    }
  },
  bounds: [[-42, -42, -42], [42, 42, 42]],
  render: { steps: 220, epsilon: 0.0045, normalEpsilon: 0.045 },
  glsl: GLSL
};
