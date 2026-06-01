const GLSL = `
float sdf(vec3 p) {
  vec3 q = p / max(radius, 0.1);
  float f = q.x * q.x * q.y * q.y + q.y * q.y * q.z * q.z + q.z * q.z * q.x * q.x - scale * q.x * q.y * q.z;
  float surface = abs(f) * radius * 2.8 - thickness;
  float ball = implicit_sphere(p, vec3(0.0), radius);
  vec3 n = normalize(vec3(cos(sectionAngle), sin(sectionAngle), 0.28));
  float sectionPlane = dot(p, n) - radius * 0.78;
  return implicit_intersect_round(implicit_intersect_round(surface, ball, 1.2), sectionPlane, 0.8);
}

vec3 color(vec3 p, vec3 normal) {
  vec3 n = normalize(vec3(cos(sectionAngle), sin(sectionAngle), 0.28));
  float cut = smoothstep(radius * 0.70, radius * 0.80, dot(p, n));
  float self = smoothstep(0.45, 0.98, abs(normal.x * normal.y * normal.z) * 6.0);
  return mix(mix(baseColor * 0.7, baseColor, self), accentColor, cut * 0.78);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "roman surface section",
  description: "Prompt 16: Steiner Roman surface with smooth self-intersections and section visualization.",
  units: "mm",
  params: {
    radius: { type: "number", label: "Clip radius", min: 18, max: 44, step: 0.25, default: 31, unit: "mm" },
    scale: { type: "number", label: "Roman scale", min: 0.45, max: 1.4, step: 0.02, default: 0.92 },
    thickness: { type: "number", label: "Thickness", min: 0.2, max: 4, step: 0.05, default: 1.15, unit: "mm" },
    sectionAngle: { type: "number", label: "Section angle", min: -1.57, max: 1.57, step: 0.02, default: 0.45, unit: "rad" },
    baseColor: { type: "color", label: "Surface color", default: "#ff5c8a" },
    accentColor: { type: "color", label: "Section color", default: "#fff06a" }
  },
  animations: {
    sectionTurn: {
      label: "Section turn",
      duration: 6.4,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("sectionAngle", wave * 1.25);
        set("scale", 0.78 + (1 - Math.abs(wave)) * 0.45);
      }
    }
  },
  bounds: [[-44, -44, -44], [44, 44, 44]],
  render: { steps: 320, epsilon: 0.0045, normalEpsilon: 0.05 },
  glsl: GLSL
};
