const GLSL = `
float sdf(vec3 p) {
  vec3 q = implicit_rotate_axis(p, vec3(0.0), vec3(0.0, 0.0, 1.0), p.z * (twist * 0.018));
  float orb = implicit_sphere(q, vec3(0.0), radius);
  float ring = implicit_torus(q.xzy, radius * 0.72, shell);
  float groove = implicit_torus(q.yxz, radius * 0.54, shell * 0.62);
  float carved = implicit_intersect_round(orb, -groove, max(shell * 0.35, 0.4));
  return implicit_union_round(carved, ring, max(shell * 0.55, 0.5));
}

vec3 color(vec3 p, vec3 normal) {
  float bands = 0.5 + 0.5 * sin(0.07 * p.z + 2.5 * twist + normal.z * 1.4);
  return mix(baseColor, accentColor, bands);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "parametric pulse",
  units: "mm",
  params: {
    radius: { type: "number", label: "Radius", min: 12, max: 34, step: 0.25, default: 22, unit: "mm" },
    twist: { type: "number", label: "Twist", min: -2.5, max: 2.5, step: 0.05, default: 0 },
    shell: { type: "number", label: "Shell", min: 1, max: 8, step: 0.1, default: 3.5, unit: "mm" },
    baseColor: { type: "color", label: "Cool color", default: "#20d9ff" },
    accentColor: { type: "color", label: "Pulse color", default: "#ff6b3d" }
  },
  animations: {
    breathe: {
      label: "Breathe",
      duration: 3.2,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("radius", 22 + wave * 7);
        set("twist", wave * 1.6);
        set("shell", 3.5 + wave * 1.8);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = Math.max(params.radius + params.shell + 10, 42);
    return [[-extent, -extent, -extent], [extent, extent, extent]];
  },
  glsl: GLSL,
  render: { steps: 224 }
};
