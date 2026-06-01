const GLSL = `
float sdf(vec3 p) {
  float left = implicit_torus(p - vec3(-(separation * 0.5), 0.0, 0.0), majorRadius, tubeRadius);
  float right = implicit_torus(p - vec3((separation * 0.5), 0.0, 0.0), majorRadius, tubeRadius);
  float bridge = implicit_capsule(p, vec3(-max((separation * 0.5) - tubeRadius * 0.6, tubeRadius), 0.0, 0.0), vec3(max((separation * 0.5) - tubeRadius * 0.6, tubeRadius), 0.0, 0.0), bridgeRadius);
  float handles = implicit_union_round(left, right, blend);
  return implicit_union_round(handles, bridge, max(blend * 0.78, 0.4));
}


vec3 color(vec3 p, vec3 normal) {
  float side = smoothstep(-18.0, 18.0, p.x);
  return mix(mix(leftColor, rightColor, side), highlightColor, smoothstep(0.65, 0.98, abs(normal.z)) * 0.28);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "genus-2 double torus",
  description: "Two toroidal handles smoothly fused into one symmetric watertight genus-2 solid.",
  units: "mm",
  params: {
    separation: { type: "number", label: "Handle spacing", min: 16, max: 34, step: 0.25, default: 26, unit: "mm" },
    majorRadius: { type: "number", label: "Major radius", min: 7, max: 15, step: 0.25, default: 10.5, unit: "mm" },
    tubeRadius: { type: "number", label: "Tube radius", min: 2.2, max: 6.5, step: 0.1, default: 4.2, unit: "mm" },
    bridgeRadius: { type: "number", label: "Bridge radius", min: 2.6, max: 7, step: 0.1, default: 5.2, unit: "mm" },
    blend: { type: "number", label: "Blend", min: 0.5, max: 6, step: 0.1, default: 3.8, unit: "mm" },
    leftColor: { type: "color", label: "Left handle", default: "#ff6fb1" },
    rightColor: { type: "color", label: "Right handle", default: "#7c83ff" },
    highlightColor: { type: "color", label: "Bridge light", default: "#fff06a" }
  },
  animations: {
    handleBreath: {
      label: "Handle breath",
      duration: 5.0,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("separation", 26 + wave * 5);
        set("tubeRadius", 4.2 + wave * 1.1);
        set("blend", 3.8 + wave * 2.0);
      }
    }
  },
  bounds: ({ params }) => {
    const halfSpacing = params.separation / 2;
    const x = halfSpacing + params.majorRadius + params.tubeRadius + params.blend + 8;
    const yz = params.majorRadius + params.tubeRadius + params.blend + 8;
    return [[-x, -yz, -yz], [x, yz, yz]];
  },
  render: ({ params }) => ({
    steps: 240,
    epsilon: Math.max(0.004, params.tubeRadius * 0.0014),
    normalEpsilon: Math.max(0.035, params.tubeRadius * 0.011)
  }),
  glsl: GLSL
};
