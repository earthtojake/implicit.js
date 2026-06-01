const GLSL = `
float sdf(vec3 p) {
  vec3 q = p / max(scale, 0.1);
  float f = q.x*q.x*q.x*q.x - 5.0*q.x*q.x + q.y*q.y*q.y*q.y - 5.0*q.y*q.y + q.z*q.z*q.z*q.z - 5.0*q.z*q.z + constant;
  float shell = abs(f) * scale * 0.42 - thickness;
  float clip = implicit_sphere(p, vec3(0.0), scale * 2.72);
  return implicit_intersect_round(shell, clip, max(tunnelRound, 0.25));
}

vec3 color(vec3 p, vec3 normal) {
  float lobe = smoothstep(0.15, 0.94, max(max(abs(normal.x), abs(normal.y)), abs(normal.z)));
  float tunnel = 0.5 + 0.5 * sin((p.x + p.y + p.z) / max(scale, 0.1) * 2.6);
  return mix(baseColor * (0.7 + 0.3 * tunnel), accentColor, lobe * 0.46);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "tanglecube lobed tunnels",
  description: "Prompt 17: tanglecube algebraic surface with cubic symmetry and smooth tunnels.",
  units: "mm",
  params: {
    scale: { type: "number", label: "Scale", min: 10, max: 24, step: 0.25, default: 16, unit: "mm" },
    constant: { type: "number", label: "Constant", min: 8, max: 15, step: 0.05, default: 11.8 },
    thickness: { type: "number", label: "Shell thickness", min: 0.4, max: 4, step: 0.05, default: 1.1, unit: "mm" },
    tunnelRound: { type: "number", label: "Tunnel round", min: 0, max: 6, step: 0.1, default: 2.4, unit: "mm" },
    baseColor: { type: "color", label: "Lobe color", default: "#4ade80" },
    accentColor: { type: "color", label: "Tunnel color", default: "#a78bfa" }
  },
  animations: {
    nodeBloom: {
      label: "Node bloom",
      duration: 6,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("constant", 10.5 + (wave * 0.5 + 0.5) * 2.6);
        set("tunnelRound", 1.2 + (1 - Math.abs(wave)) * 4.2);
      }
    }
  },
  bounds: [[-48, -48, -48], [48, 48, 48]],
  render: { steps: 330, epsilon: 0.0045, normalEpsilon: 0.05 },
  glsl: GLSL
};
