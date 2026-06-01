const GLSL = `
float sdf(vec3 p) {
  float sphereBody = implicit_sphere(p, vec3(0.0, 0.0, 0.0), radius);
  float cutBox = implicit_box_centered(p, vec3(radius * 1.58, radius * 1.58, baseHeight), vec3(0.0, 0.0, -radius * 0.75));
  float bore = implicit_cylinder_capped(p, vec3(-radius * 1.25, 0.0, radius * 0.2), vec3(radius * 1.25, 0.0, radius * 0.2), boreRadius);
  return implicit_intersect_round(
    implicit_union_round(sphereBody, cutBox, blend),
    -bore,
    max(blend * 0.5, 0.35)
  );
}


vec3 color(vec3 p, vec3 normal) {
  float sphereBlend = smoothstep(-18.0, 18.0, p.z);
  vec3 base = mix(orbLowColor, orbHighColor, sphereBlend);
  float plinthMask = 1.0 - smoothstep(-17.0, -7.0, p.z);
  base = mix(base, baseColor, plinthMask * 0.9);
  float boreAccent = smoothstep(0.72, 0.98, abs(normal.x)) * smoothstep(-2.0, 12.0, p.z);
  return mix(base, accentColor, boreAccent);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "rounded orb",
  units: "mm",
  params: {
    radius: { type: "number", label: "Radius", min: 14, max: 32, step: 0.25, default: 24, unit: "mm" },
    baseHeight: { type: "number", label: "Base height", min: 8, max: 24, step: 0.25, default: 16, unit: "mm" },
    boreRadius: { type: "number", label: "Bore radius", min: 2, max: 11, step: 0.1, default: 7, unit: "mm" },
    blend: { type: "number", label: "Blend", min: 0.5, max: 6, step: 0.1, default: 3, unit: "mm" },
    orbLowColor: { type: "color", label: "Lower orb", default: "#22d3ee" },
    orbHighColor: { type: "color", label: "Upper orb", default: "#ff7ac8" },
    baseColor: { type: "color", label: "Base color", default: "#2df5a5" },
    accentColor: { type: "color", label: "Bore accent", default: "#ffd166" }
  },
  animations: {
    boreBreath: {
      label: "Bore breath",
      duration: 4.2,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("boreRadius", 7 + wave * 3);
        set("blend", 3 + wave * 2);
        set("baseHeight", 16 + wave * 5);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = params.radius + params.blend + 9;
    return [[-extent, -extent, -extent], [extent, extent, extent]];
  },
  render: ({ params }) => ({
    steps: 224,
    epsilon: Math.max(0.004, params.radius * 0.00025),
    normalEpsilon: Math.max(0.035, params.radius * 0.0018)
  }),
  glsl: GLSL
};
