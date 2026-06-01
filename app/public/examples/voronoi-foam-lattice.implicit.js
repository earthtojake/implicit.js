const GLSL = `
vec3 hash33(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}

float voronoiWall(vec3 p) {
  vec3 g = floor(p);
  vec3 f = fract(p);
  float f1 = 10.0;
  float f2 = 10.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 o = vec3(float(x), float(y), float(z));
        vec3 r = o + hash33(g + o) - f;
        float d = dot(r, r);
        if (d < f1) {
          f2 = f1;
          f1 = d;
        } else if (d < f2) {
          f2 = d;
        }
      }
    }
  }
  return abs(sqrt(f2) - sqrt(f1));
}

float sdf(vec3 p) {
  float wall = voronoiWall(p / max(cellSize, 0.1)) * cellSize - wallThickness;
  float roundedWall = wall - roundness * 0.22;
  float box = implicit_box_centered(p, vec3(boundsSize), vec3(0.0));
  return implicit_intersect_round(roundedWall, box, roundness);
}

vec3 color(vec3 p, vec3 normal) {
  float cell = voronoiWall(p / max(cellSize, 0.1));
  float veins = smoothstep(0.0, 0.32, cell);
  float depth = smoothstep(-boundsSize * 0.5, boundsSize * 0.5, p.z);
  float rim = pow(max(dot(normal, normalize(vec3(-0.45, 0.35, 0.82))), 0.0), 2.4);
  vec3 wall = mix(baseColor * (0.65 + 0.35 * depth), accentColor, veins * 0.62);
  return mix(wall, rimColor, rim * 0.32);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "voronoi foam lattice",
  description: "Prompt 20: bounded implicit Voronoi foam with rounded cell-wall transitions.",
  units: "mm",
  params: {
    boundsSize: { type: "number", label: "Bounds size", min: 34, max: 84, step: 1, default: 58, unit: "mm" },
    cellSize: { type: "number", label: "Cell size", min: 10, max: 28, step: 0.5, default: 18, unit: "mm" },
    wallThickness: { type: "number", label: "Wall thickness", min: 0.4, max: 4, step: 0.1, default: 1.4, unit: "mm" },
    roundness: { type: "number", label: "Roundness", min: 0.2, max: 4, step: 0.1, default: 1.7, unit: "mm" },
    baseColor: { type: "color", label: "Wall color", default: "#24e6c2" },
    accentColor: { type: "color", label: "Cell color", default: "#ff9f43" },
    rimColor: { type: "color", label: "Rim color", default: "#c4a7ff" }
  },
  animations: {
    foamBreath: {
      label: "Foam breath",
      duration: 6.6,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("wallThickness", 0.9 + (wave * 0.5 + 0.5) * 2.4);
        set("roundness", 0.8 + (1 - Math.abs(wave)) * 2.8);
      }
    }
  },
  bounds: [[-48, -48, -48], [48, 48, 48]],
  render: { steps: 340, epsilon: 0.005, normalEpsilon: 0.055 },
  glsl: GLSL
};
