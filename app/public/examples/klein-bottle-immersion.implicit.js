const GLSL = `
const float KLEIN_TAU = 6.283185307179586;

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 0.0001);
}

float sdCapsuleLine(vec3 p, vec3 a, vec3 b) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h);
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xy) - t.x, p.z);
  return length(q) - t.y;
}

vec3 cubicBezier(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
  float s = 1.0 - t;
  return s * s * s * a + 3.0 * s * s * t * b + 3.0 * s * t * t * c + t * t * t * d;
}

float neckCenterDistance(vec3 q) {
  vec3 p0 = vec3(0.0, -0.03, bulbHeight * 0.82);
  vec3 p1 = vec3(0.12, -bulbDepth * 0.18, bulbHeight + neckRise);
  vec3 p2 = vec3(-handleReach, -bulbDepth * 0.95, bulbHeight + neckRise * 0.72);
  vec3 p3 = vec3(-entryOffset, -bulbDepth * 1.02, 0.12);
  vec3 p4 = vec3(0.08, -bulbDepth * 0.22, -bulbHeight * 0.56);

  vec3 previous = p0;
  float d = 10000.0;
  for (int i = 1; i <= 28; i += 1) {
    float t = float(i) / 28.0;
    vec3 current = cubicBezier(p0, p1, p2, p3, t);
    d = min(d, sdCapsuleLine(q, previous, current));
    previous = current;
  }

  previous = p3;
  for (int i = 1; i <= 20; i += 1) {
    float t = float(i) / 20.0;
    vec3 current = cubicBezier(
      p3,
      vec3(-entryOffset * 0.7, -bulbDepth * 0.72, -0.34),
      vec3(0.16, -bulbDepth * 0.28, -bulbHeight * 0.86),
      p4,
      t
    );
    d = min(d, sdCapsuleLine(q, previous, current));
    previous = current;
  }
  return d;
}

float smoothUnion(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdf(vec3 p) {
  vec3 q = p / scale;
  q.z -= verticalOffset;

  vec3 bulbCenter = vec3(0.08, 0.0, -0.26);
  float shell = abs(sdEllipsoid(q - bulbCenter, vec3(bulbWidth, bulbDepth, bulbHeight))) - wallThickness / scale;

  vec3 entryPoint = vec3(-entryOffset, -bulbDepth * 1.02, 0.12);
  float entryHole = sdEllipsoid(q - entryPoint, vec3(neckRadius * 1.85, neckRadius * 1.34, neckRadius * 2.05));
  shell = max(shell, -entryHole);

  float neckCore = neckCenterDistance(q) - neckRadius;
  float neck = abs(neckCore) - wallThickness / scale;

  vec3 topPoint = q - vec3(0.0, -0.03, bulbHeight * 0.82);
  float topLip = abs(sdTorus(vec3(topPoint.x, topPoint.y, topPoint.z * 0.76), vec2(neckRadius, wallThickness / scale * 1.15))) - wallThickness / scale * 0.5;

  float body = smoothUnion(shell, neck, blendRadius);
  return min(body, topLip) * scale;
}

vec3 color(vec3 p, vec3 normal) {
  vec3 q = p / max(scale, 0.0001);
  q.z -= verticalOffset;
  float neckBand = 1.0 - smoothstep(neckRadius + 0.02, neckRadius + 0.54, neckCenterDistance(q));
  float entryGlow = 1.0 - smoothstep(0.0, neckRadius * 2.1, length(q - vec3(-entryOffset, -bulbDepth * 1.02, 0.12)));
  float heightBand = smoothstep(-bulbHeight * 0.9, bulbHeight * 1.18, q.z);
  float swirl = 0.5 + 0.5 * sin(KLEIN_TAU * (atan(q.y, q.x) / KLEIN_TAU + q.z * 0.22));
  float rim = pow(max(dot(normal, normalize(vec3(-0.35, 0.56, 0.75))), 0.0), 2.0);
  vec3 body = mix(bulbColor, insideColor, heightBand * 0.24 + swirl * 0.12);
  body = mix(body, neckColor, neckBand * 0.82);
  body = mix(body, insideColor, entryGlow * 0.52);
  return mix(body, rimColor, rim * 0.35);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "Klein bottle immersion",
  description: "A fast bounded classic Klein bottle model with a visible self-passing neck and front entry.",
  units: "mm",
  params: {
    scale: { type: "number", label: "Scale", min: 10, max: 30, step: 0.25, default: 17, unit: "mm" },
    wallThickness: { type: "number", label: "Wall thickness", min: 0.25, max: 2.2, step: 0.05, default: 0.62, unit: "mm" },
    bulbWidth: { type: "number", label: "Bulb width", min: 1.0, max: 2.0, step: 0.02, default: 1.25 },
    bulbDepth: { type: "number", label: "Bulb depth", min: 0.75, max: 1.55, step: 0.02, default: 1.05 },
    bulbHeight: { type: "number", label: "Bulb height", min: 1.35, max: 2.55, step: 0.02, default: 1.88 },
    neckRadius: { type: "number", label: "Neck radius", min: 0.16, max: 0.58, step: 0.01, default: 0.29 },
    handleReach: { type: "number", label: "Handle reach", min: 1.1, max: 2.5, step: 0.02, default: 1.58 },
    neckRise: { type: "number", label: "Neck rise", min: 0.45, max: 1.45, step: 0.02, default: 1.08 },
    entryOffset: { type: "number", label: "Entry offset", min: -0.45, max: 0.85, step: 0.02, default: 0.14 },
    blendRadius: { type: "number", label: "Blend", min: 0.02, max: 0.28, step: 0.01, default: 0.08 },
    verticalOffset: { type: "number", label: "Vertical offset", min: -0.8, max: 0.8, step: 0.02, default: -0.04 },
    bulbColor: { type: "color", label: "Bulb color", default: "#b36bff" },
    neckColor: { type: "color", label: "Neck color", default: "#35e7ff" },
    insideColor: { type: "color", label: "Inside color", default: "#ff86ca" },
    rimColor: { type: "color", label: "Rim color", default: "#ffe066" }
  },
  animations: {
    bottleBreath: {
      label: "Bottle breath",
      duration: 5.8,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("handleReach", 1.58 + wave * 0.14);
        set("neckRise", 1.08 + wave * 0.08);
        set("wallThickness", 0.62 + wave * 0.08);
      }
    }
  },
  bounds: ({ params }) => {
    const x = params.scale * Math.max(params.bulbWidth + 0.45, params.handleReach + params.neckRadius + 0.35) + params.wallThickness + 5;
    const y = params.scale * (params.bulbDepth + params.neckRadius + 0.55) + params.wallThickness + 5;
    const z = params.scale * (params.bulbHeight + params.neckRise + params.neckRadius + Math.abs(params.verticalOffset) + 0.45) + params.wallThickness + 5;
    return [[-x, -y, -z], [x, y, z]];
  },
  render: ({ params }) => ({
    steps: 280,
    stepScale: 0.62,
    maxStep: Math.max(params.wallThickness * 2.5, params.scale * 0.05),
    epsilon: Math.max(0.004, params.wallThickness * 0.006),
    normalEpsilon: Math.max(0.035, params.wallThickness * 0.05)
  }),
  glsl: GLSL
};
