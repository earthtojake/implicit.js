const GLSL = `
const float IMPLICIT_MOBIUS_TAU = 6.283185307179586;

float mandelbulbDE(vec3 p) {
  vec3 z = p / max(radius * 0.72, 0.1) * detailScale;
  float dr = 1.0;
  float r = 0.0;
  for (int i = 0; i < 8; i++) {
    r = length(z);
    if (r > 2.0 || float(i) >= iterations) {
      break;
    }
    float theta = acos(clamp(z.z / max(r, 0.0001), -1.0, 1.0));
    float phi = atan(z.y, z.x);
    dr = pow(r, power - 1.0) * power * dr + 1.0;
    float zr = pow(r, power);
    theta *= power;
    phi *= power;
    z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta)) + p / max(radius * 0.72, 0.1) * detailScale;
  }
  return 0.5 * log(max(r, 0.0001)) * r / max(dr, 0.0001) * radius * 0.72;
}

float sdf(vec3 p) {
  float bulb = mandelbulbDE(p);
  float clip = implicit_sphere(p, vec3(0.0), radius);
  return max(bulb, clip);
}

vec3 implicit_palette(float t) {
  return 0.58 + 0.42 * cos(IMPLICIT_MOBIUS_TAU * (vec3(0.02, 0.38, 0.72) + t));
}

vec3 color(vec3 p, vec3 normal) {
  float orbit = atan(p.y, p.x) / IMPLICIT_MOBIUS_TAU + length(p) * 0.018;
  float ridge = pow(max(dot(normal, normalize(vec3(0.4, -0.7, 0.6))), 0.0), 2.0);
  vec3 body = implicit_palette(orbit + p.z * 0.018);
  return mix(body, vec3(1.0, 0.84, 0.48), ridge * 0.28);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "mandelbulb distance estimate",
  description: "Prompt 19: Mandelbulb-style implicit fractal using distance estimation.",
  units: "mm",
  params: {
    radius: { type: "number", label: "Fractal radius", min: 16, max: 42, step: 0.5, default: 30, unit: "mm" },
    power: { type: "number", label: "Power", min: 4, max: 10, step: 0.1, default: 8 },
    iterations: { type: "number", label: "Iterations", min: 3, max: 8, step: 1, default: 7 },
    detailScale: { type: "number", label: "Detail scale", min: 0.65, max: 1.45, step: 0.02, default: 1 }
  },
  animations: {
    powerOrbit: {
      label: "Power orbit",
      duration: 7.2,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("power", 6.2 + (wave * 0.5 + 0.5) * 3.2);
        set("detailScale", 0.82 + (1 - Math.abs(wave)) * 0.48);
      }
    }
  },
  bounds: [[-44, -44, -44], [44, 44, 44]],
  render: { steps: 420, epsilon: 0.0035, normalEpsilon: 0.045, stepScale: 0.34 },
  glsl: GLSL
};
