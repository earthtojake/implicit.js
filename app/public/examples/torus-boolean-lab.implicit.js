const GLSL = `
float sdf(vec3 p) {
  float ring = implicit_torus(p, majorRadius, minorRadius);
  float beadA = implicit_sphere(p, vec3(majorRadius, 0.0, 0.0), beadRadius);
  float beadB = implicit_sphere(p, vec3(-majorRadius, 0.0, 0.0), beadRadius * 0.82);
  float joined = implicit_union_round(implicit_union_round(ring, beadA, blend), beadB, blend);
  float drill = implicit_cylinder_capped(p, vec3(0.0, -majorRadius * 1.55, 0.0), vec3(0.0, majorRadius * 1.55, 0.0), cutRadius);
  float window = implicit_box_centered(p, vec3(cutRadius * 2.4, majorRadius * 2.6, cutRadius * 1.2), vec3(0.0));
  return implicit_intersect_round(implicit_intersect_round(joined, -drill, blend), -window, blend * 0.6);
}

vec3 color(vec3 p, vec3 normal) {
  float theta = atan(p.y, p.x);
  float stripe = 0.5 + 0.5 * sin(theta * 5.0 + p.z * 0.2);
  float cutLight = smoothstep(0.65, 0.96, abs(normal.y)) * smoothstep(-6.0, 6.0, p.z);
  vec3 body = mix(baseColor * 0.62, baseColor, stripe);
  body = mix(body, highlightColor, smoothstep(0.78, 1.0, stripe) * 0.35);
  vec3 rim = mix(accentColor * 0.55, accentColor, 0.5 + 0.5 * normal.z);
  return mix(body, rim, clamp(cutLight, 0.0, 1.0));
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "torus boolean lab",
  description: "Prompt 2: adjustable implicit torus with smooth union beads and subtractive cuts.",
  units: "mm",
  params: {
    majorRadius: { type: "number", label: "Major radius", min: 16, max: 42, step: 0.25, default: 28, unit: "mm" },
    minorRadius: { type: "number", label: "Minor radius", min: 3, max: 14, step: 0.25, default: 8, unit: "mm" },
    beadRadius: { type: "number", label: "Union bead", min: 0, max: 9, step: 0.25, default: 5.5, unit: "mm" },
    cutRadius: { type: "number", label: "Subtraction radius", min: 1, max: 12, step: 0.25, default: 6, unit: "mm" },
    blend: { type: "number", label: "Blend", min: 0.2, max: 5, step: 0.1, default: 2.2, unit: "mm" },
    baseColor: { type: "color", label: "Torus color", default: "#ff6b9a" },
    highlightColor: { type: "color", label: "Stripe highlight", default: "#fff06a" },
    accentColor: { type: "color", label: "Boolean accent", default: "#38f2b8" }
  },
  animations: {
    booleanSweep: {
      label: "Boolean sweep",
      duration: 5.2,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("minorRadius", 7 + wave * 3.5);
        set("cutRadius", 4 + (wave * 0.5 + 0.5) * 6);
        set("beadRadius", 3 + (1.0 - Math.abs(wave)) * 6);
      }
    }
  },
  bounds: [[-54, -54, -22], [54, 54, 22]],
  render: { steps: 240, epsilon: 0.004, normalEpsilon: 0.04 },
  glsl: GLSL
};
