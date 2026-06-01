const GLSL = `
float sdf(vec3 p) {
  vec3 q = abs(p) / vec3(size, size, size * heightScale);
  float superquadric = pow(pow(q.x, exponent) + pow(q.y, exponent) + pow(q.z, exponent), 1.0 / exponent) - 1.0;
  return superquadric * size;
}


vec3 color(vec3 p, vec3 normal) {
  float face = pow(max(abs(normal.x), max(abs(normal.y), abs(normal.z))), 3.0);
  return mix(edgeColor, faceColor, face);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "superquadric rounded cube",
  description: "A high-even-exponent superquadric with flat faces and smoothly rounded edges and corners.",
  units: "mm",
  params: {
    size: { type: "number", label: "Size", min: 12, max: 34, step: 0.25, default: 21, unit: "mm" },
    exponent: { type: "number", label: "Squareness", min: 2, max: 16, step: 0.25, default: 8 },
    heightScale: { type: "number", label: "Height scale", min: 0.55, max: 1.45, step: 0.02, default: 1 },
    faceColor: { type: "color", label: "Face color", default: "#ffe45c" },
    edgeColor: { type: "color", label: "Edge color", default: "#ff7a66" }
  },
  animations: {
    cubeMorph: {
      label: "Cube morph",
      duration: 4.6,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("exponent", 8 + wave * 5.2);
        set("heightScale", 1 + wave * 0.28);
      }
    }
  },
  bounds: ({ params }) => {
    const xy = params.size + 9;
    const z = params.size * params.heightScale + 9;
    return [[-xy, -xy, -z], [xy, xy, z]];
  },
  render: ({ params }) => ({
    steps: 220,
    epsilon: Math.max(0.004, params.size * 0.00025),
    normalEpsilon: Math.max(0.035, params.size * 0.002)
  }),
  glsl: GLSL
};
