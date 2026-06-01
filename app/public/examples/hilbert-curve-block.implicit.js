const GLSL = `
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdSegment2(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h);
}

vec2 hilbertGridPoint2(float i) {
  float index = clamp(floor(i + 0.5), 0.0, 63.0);
  if (index < 0.5) { return vec2(0.0, 0.0); }
  if (index < 1.5) { return vec2(0.0, 1.0); }
  if (index < 2.5) { return vec2(1.0, 1.0); }
  if (index < 3.5) { return vec2(1.0, 0.0); }
  if (index < 4.5) { return vec2(2.0, 0.0); }
  if (index < 5.5) { return vec2(3.0, 0.0); }
  if (index < 6.5) { return vec2(3.0, 1.0); }
  if (index < 7.5) { return vec2(2.0, 1.0); }
  if (index < 8.5) { return vec2(2.0, 2.0); }
  if (index < 9.5) { return vec2(3.0, 2.0); }
  if (index < 10.5) { return vec2(3.0, 3.0); }
  if (index < 11.5) { return vec2(2.0, 3.0); }
  if (index < 12.5) { return vec2(1.0, 3.0); }
  if (index < 13.5) { return vec2(1.0, 2.0); }
  if (index < 14.5) { return vec2(0.0, 2.0); }
  if (index < 15.5) { return vec2(0.0, 3.0); }
  if (index < 16.5) { return vec2(0.0, 4.0); }
  if (index < 17.5) { return vec2(1.0, 4.0); }
  if (index < 18.5) { return vec2(1.0, 5.0); }
  if (index < 19.5) { return vec2(0.0, 5.0); }
  if (index < 20.5) { return vec2(0.0, 6.0); }
  if (index < 21.5) { return vec2(0.0, 7.0); }
  if (index < 22.5) { return vec2(1.0, 7.0); }
  if (index < 23.5) { return vec2(1.0, 6.0); }
  if (index < 24.5) { return vec2(2.0, 6.0); }
  if (index < 25.5) { return vec2(2.0, 7.0); }
  if (index < 26.5) { return vec2(3.0, 7.0); }
  if (index < 27.5) { return vec2(3.0, 6.0); }
  if (index < 28.5) { return vec2(3.0, 5.0); }
  if (index < 29.5) { return vec2(2.0, 5.0); }
  if (index < 30.5) { return vec2(2.0, 4.0); }
  if (index < 31.5) { return vec2(3.0, 4.0); }
  if (index < 32.5) { return vec2(4.0, 4.0); }
  if (index < 33.5) { return vec2(5.0, 4.0); }
  if (index < 34.5) { return vec2(5.0, 5.0); }
  if (index < 35.5) { return vec2(4.0, 5.0); }
  if (index < 36.5) { return vec2(4.0, 6.0); }
  if (index < 37.5) { return vec2(4.0, 7.0); }
  if (index < 38.5) { return vec2(5.0, 7.0); }
  if (index < 39.5) { return vec2(5.0, 6.0); }
  if (index < 40.5) { return vec2(6.0, 6.0); }
  if (index < 41.5) { return vec2(6.0, 7.0); }
  if (index < 42.5) { return vec2(7.0, 7.0); }
  if (index < 43.5) { return vec2(7.0, 6.0); }
  if (index < 44.5) { return vec2(7.0, 5.0); }
  if (index < 45.5) { return vec2(6.0, 5.0); }
  if (index < 46.5) { return vec2(6.0, 4.0); }
  if (index < 47.5) { return vec2(7.0, 4.0); }
  if (index < 48.5) { return vec2(7.0, 3.0); }
  if (index < 49.5) { return vec2(7.0, 2.0); }
  if (index < 50.5) { return vec2(6.0, 2.0); }
  if (index < 51.5) { return vec2(6.0, 3.0); }
  if (index < 52.5) { return vec2(5.0, 3.0); }
  if (index < 53.5) { return vec2(4.0, 3.0); }
  if (index < 54.5) { return vec2(4.0, 2.0); }
  if (index < 55.5) { return vec2(5.0, 2.0); }
  if (index < 56.5) { return vec2(5.0, 1.0); }
  if (index < 57.5) { return vec2(4.0, 1.0); }
  if (index < 58.5) { return vec2(4.0, 0.0); }
  if (index < 59.5) { return vec2(5.0, 0.0); }
  if (index < 60.5) { return vec2(6.0, 0.0); }
  if (index < 61.5) { return vec2(6.0, 1.0); }
  if (index < 62.5) { return vec2(7.0, 1.0); }
  return vec2(7.0, 0.0);
}

vec2 hilbertBlockPoint(float i) {
  return (hilbertGridPoint2(i) - vec2(3.5)) * cellSize;
}

float channelField(vec2 p) {
  float d = 100000.0;
  for (int i = 0; i < 63; i += 1) {
    float fi = float(i);
    d = min(d, sdSegment2(p, hilbertBlockPoint(fi), hilbertBlockPoint(fi + 1.0)));
  }
  return d;
}

float sdf(vec3 p) {
  float extent = cellSize * 4.1;
  float plate = sdBox(p + vec3(0.0, 0.0, plateThickness * 0.18), vec3(extent, extent, plateThickness * 0.42));
  float channel = max(channelField(p.xy) - channelWidth, abs(p.z - plateThickness * 0.18) - plateThickness * 0.34);
  float raisedRim = max(channelField(p.xy) - channelWidth * 1.35, abs(p.z - plateThickness * 0.42) - liftHeight * 0.36);
  return min(max(plate, -channel), raisedRim);
}

vec3 color(vec3 p, vec3 normal) {
  float path = smoothstep(channelWidth * 1.8, channelWidth * 0.35, channelField(p.xy));
  float grid = 0.5 + 0.5 * sin((p.x + p.y) * 0.22);
  vec3 plateColor = mix(baseColor * 0.52, baseColor, 0.45 + 0.55 * normal.z);
  vec3 pathColor = mix(accentColor * 0.72, accentColor, grid);
  return mix(plateColor, pathColor, path);
}
`;

export default {
  schema: "implicit.js/0.1.0",
  name: "2D Hilbert curve block",
  description: "A true order-3 planar Hilbert curve cut into a solid plate with a raised colored trace.",
  units: "mm",
  params: {
    cellSize: { type: "number", label: "Cell size", min: 3.5, max: 8, step: 0.1, default: 5.3, unit: "mm" },
    channelWidth: { type: "number", label: "Channel width", min: 0.45, max: 2.4, step: 0.05, default: 1.15, unit: "mm" },
    plateThickness: { type: "number", label: "Plate thickness", min: 1.6, max: 6, step: 0.1, default: 3.2, unit: "mm" },
    liftHeight: { type: "number", label: "Trace lift", min: 0.3, max: 2.4, step: 0.05, default: 1.0, unit: "mm" },
    baseColor: { type: "color", label: "Plate color", default: "#a5b4fc" },
    accentColor: { type: "color", label: "Trace color", default: "#ccff33" }
  },
  animations: {
    channelBreath: {
      label: "Channel breath",
      duration: 4.2,
      loop: true,
      update({ progress, set }) {
        const wave = Math.sin(progress * Math.PI * 2);
        set("channelWidth", 1.15 + wave * 0.42);
        set("liftHeight", 1.0 + (wave * 0.5 + 0.5) * 0.75);
      }
    }
  },
  bounds: ({ params }) => {
    const extent = params.cellSize * 4.45 + params.channelWidth + 4;
    const z = params.plateThickness + params.liftHeight + 3;
    return [[-extent, -extent, -z], [extent, extent, z]];
  },
  render: ({ params }) => ({
    steps: 190,
    stepScale: 0.7,
    maxStep: Math.max(params.channelWidth * 3.5, 1.1),
    epsilon: Math.max(params.channelWidth * 0.012, 0.004),
    normalEpsilon: Math.max(params.channelWidth * 0.08, 0.035)
  }),
  glsl: GLSL
};
