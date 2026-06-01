const GLSL = `
float sdf(vec3 p) {
  float d = implicit_sphere(p, vec3(0.0), coreRadius);
  d = implicit_union_round(d, implicit_sphere(p, vec3(spacing, 0.0, 0.0), satelliteRadius), blend);
  d = implicit_union_round(d, implicit_sphere(p, vec3(-spacing, 0.0, 0.0), satelliteRadius), blend);
  d = implicit_union_round(d, implicit_sphere(p, vec3(0.0, spacing, 0.0), satelliteRadius), blend);
  d = implicit_union_round(d, implicit_sphere(p, vec3(0.0, -spacing, 0.0), satelliteRadius), blend);
  d = implicit_union_round(d, implicit_sphere(p, vec3(0.0, 0.0, spacing), satelliteRadius), blend);
  d = implicit_union_round(d, implicit_sphere(p, vec3(0.0, 0.0, -spacing), satelliteRadius), blend);
  return d;
}


vec3 color(vec3 p, vec3 normal) {
  vec3 directionTint = normalize(abs(p) + vec3(0.001));
  return xColor * directionTint.x + yColor * directionTint.y + zColor * directionTint.z;
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "metaball molecule cluster",
  description: "Seven overlapping spheres blended into one smooth organic implicit solid.",
  units: "mm",
  params: {
    coreRadius: { type: "number", label: "Core radius", min: 5, max: 14, step: 0.1, default: 9.5, unit: "mm" },
    satelliteRadius: { type: "number", label: "Satellite radius", min: 3.5, max: 10, step: 0.1, default: 7.2, unit: "mm" },
    spacing: { type: "number", label: "Spacing", min: 7, max: 20, step: 0.25, default: 13, unit: "mm" },
    blend: { type: "number", label: "Blend", min: 0.5, max: 8, step: 0.1, default: 5, unit: "mm" },
    xColor: { type: "color", label: "X lobes", default: "#4f8cff" },
    yColor: { type: "color", label: "Y lobes", default: "#5cff89" },
    zColor: { type: "color", label: "Z lobes", default: "#ff66d8" }
  },
  animations: {
    clusterPulse: {
      label: "Cluster pulse",
      duration: 4.6,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("spacing", 13 + wave * 4);
        set("blend", 5 + wave * 2.2);
        set("satelliteRadius", 7.2 + wave * 1.6);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = params.spacing + Math.max(params.coreRadius, params.satelliteRadius) + params.blend + 5;
    return [[-extent, -extent, -extent], [extent, extent, extent]];
  },
  render: ({ params }) => ({
    steps: 240,
    epsilon: Math.max(0.004, Math.min(params.coreRadius, params.satelliteRadius) * 0.0007),
    normalEpsilon: Math.max(0.035, params.blend * 0.009)
  }),
  glsl: GLSL
};
