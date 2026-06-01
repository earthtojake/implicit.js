const GLSL = `
const float PLANETARY_TAU = 6.283185307179586;

float planetaryRoundedSunTeeth() {
  return clamp(floor(sunTeeth + 0.5), 12.0, 30.0);
}

float planetaryPlanetTeeth() {
  return max(floor(planetTeeth + 0.5), 3.0);
}

float planetarySunTeeth() {
  float sun = planetaryRoundedSunTeeth();
  float planet = planetaryPlanetTeeth();
  float remainder = mod(sun + planet, 3.0);
  float adjusted = sun;
  if (remainder > 0.5 && remainder < 1.5) {
    adjusted -= 1.0;
  } else if (remainder >= 1.5) {
    adjusted += 1.0;
  }
  if (adjusted < 12.0) {
    adjusted += 3.0;
  }
  if (adjusted > 30.0) {
    adjusted -= 3.0;
  }
  return max(adjusted, 3.0);
}

float planetaryRingTeeth() {
  return planetarySunTeeth() + planetaryPlanetTeeth() * 2.0;
}

float planetarySunPitch() {
  return gearModule * planetarySunTeeth() * 0.5;
}

float planetaryPlanetPitch() {
  return gearModule * planetaryPlanetTeeth() * 0.5;
}

float planetaryMeshSpread() {
  return max(meshOffset, 0.0);
}

float planetaryRingPitch() {
  return gearModule * planetaryRingTeeth() * 0.5 + planetaryMeshSpread();
}

float planetaryDriveRadians() {
  return meshPhase * 0.017453292519943295;
}

float planetaryCarrierRadians() {
  return carrierAngle * 0.017453292519943295;
}

float planetaryDrivenRingRadians() {
  float sun = planetarySunTeeth();
  float ring = planetaryRingTeeth();
  float carrier = planetaryCarrierRadians();
  return carrier - (sun / max(ring, 1.0)) * (planetaryDriveRadians() - carrier);
}

float planetaryRingRadians() {
  float oddPlanetOffset = mod(planetaryPlanetTeeth(), 2.0) * PLANETARY_TAU * 0.5 / max(planetaryRingTeeth(), 1.0);
  return ringPhase * 0.017453292519943295 + planetaryDrivenRingRadians() + oddPlanetOffset;
}

float planetaryToothWave(float angle, float teeth, float phase) {
  float wave = 0.5 + 0.5 * cos((angle - phase) * teeth);
  return wave * wave * (3.0 - 2.0 * wave);
}

float planetaryExtrude(float d2, float z, float halfHeight, float bevel) {
  vec2 q = vec2(d2, abs(z) - halfHeight + bevel);
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - bevel;
}

float planetaryExternalGear2(vec2 p, float pitchRadius, float teeth, float phase) {
  float theta = atan(p.y, p.x);
  float tooth = planetaryToothWave(theta, teeth, phase);
  float root = toothDepth * 0.72;
  float addendum = toothDepth * 0.82;
  float meshClearance = max(backlash, max(gearModule * 0.05, toothDepth * 0.18));
  float boundary = pitchRadius - root + tooth * (root + addendum) - meshClearance * 0.52;
  return length(p) - boundary;
}

float planetaryInternalRing2(vec2 p, float pitchRadius, float teeth, float phase) {
  float theta = atan(p.y, p.x);
  float tooth = planetaryToothWave(theta, teeth, phase);
  float root = toothDepth * 0.78;
  float addendum = toothDepth * 0.9;
  float meshClearance = max(backlash, max(gearModule * 0.05, toothDepth * 0.18));
  float innerBoundary = pitchRadius + root - tooth * (root + addendum) + meshClearance * 0.86;
  float outerBoundary = pitchRadius + toothDepth * 2.55 + gearModule * 3.0;
  return max(innerBoundary - length(p), length(p) - outerBoundary);
}

float planetaryExternalGear(vec3 p, vec2 center, float pitchRadius, float teeth, float phase) {
  float gear = planetaryExternalGear2(p.xy - center, pitchRadius, teeth, phase);
  return planetaryExtrude(gear, p.z, thickness * 0.5, min(gearModule * 0.16, 0.38));
}

float planetaryRingGear(vec3 p) {
  float ring = planetaryInternalRing2(p.xy, planetaryRingPitch(), planetaryRingTeeth(), planetaryRingRadians());
  return planetaryExtrude(ring, p.z, thickness * 0.5, min(gearModule * 0.14, 0.34));
}

float planetarySunGear(vec3 p) {
  float gear = planetaryExternalGear(p, vec2(0.0), planetarySunPitch(), planetarySunTeeth(), planetaryDriveRadians());
  float bore = implicit_cylinder_capped(
    p,
    vec3(0.0, 0.0, -thickness),
    vec3(0.0, 0.0, thickness),
    max(gearModule * 1.15, planetarySunPitch() * 0.19)
  );
  float hub = planetaryExtrude(length(p.xy) - planetarySunPitch() * 0.42, p.z, thickness * 0.58, min(gearModule * 0.18, 0.42));
  return implicit_intersect_round(implicit_union_round(gear, hub, gearModule * 0.18), -bore, gearModule * 0.12);
}

vec2 planetaryPlanetCenter(float index) {
  float angle = planetaryCarrierRadians() + index * PLANETARY_TAU / 3.0;
  float orbit = planetarySunPitch() + planetaryPlanetPitch() + planetaryMeshSpread();
  return orbit * vec2(cos(angle), sin(angle));
}

float planetaryPlanetPhase(float index) {
  float planet = planetaryPlanetTeeth();
  float centerAngle = planetaryCarrierRadians() + index * PLANETARY_TAU / 3.0;
  float sunRatio = planetarySunTeeth() / max(planet, 1.0);
  float carrierRatio = (planetarySunTeeth() + planet) / max(planet, 1.0);
  float toothOffset = PLANETARY_TAU * 0.5 - PLANETARY_TAU * 0.5 / max(planet, 1.0);
  return centerAngle * carrierRatio - planetaryDriveRadians() * sunRatio + toothOffset;
}

float planetaryPlanetGear(vec3 p, float index) {
  vec2 center = planetaryPlanetCenter(index);
  float gear = planetaryExternalGear(p, center, planetaryPlanetPitch(), planetaryPlanetTeeth(), planetaryPlanetPhase(index));
  float bore = implicit_cylinder_capped(
    p,
    vec3(center, -thickness),
    vec3(center, thickness),
    max(gearModule * 0.86, planetaryPlanetPitch() * 0.2)
  );
  float pinBoss = planetaryExtrude(length(p.xy - center) - max(gearModule * 1.35, planetaryPlanetPitch() * 0.34), p.z, thickness * 0.54, min(gearModule * 0.16, 0.36));
  return implicit_intersect_round(implicit_union_round(gear, pinBoss, gearModule * 0.15), -bore, gearModule * 0.1);
}

float planetaryCarrierArm(vec3 p, vec2 center) {
  float zCenter = -thickness * 0.72;
  float arm2 = implicit_line_segment2(p.xy, vec2(0.0), center) - gearModule * 0.95;
  return planetaryExtrude(arm2, p.z - zCenter, thickness * 0.16, min(gearModule * 0.16, 0.35));
}

float planetaryCarrier(vec3 p) {
  float hub = planetaryExtrude(length(p.xy) - max(gearModule * 2.1, planetarySunPitch() * 0.34), p.z + thickness * 0.72, thickness * 0.17, min(gearModule * 0.16, 0.35));
  float carrier = hub;
  for (int i = 0; i < 3; i += 1) {
    vec2 center = planetaryPlanetCenter(float(i));
    float arm = planetaryCarrierArm(p, center);
    float pin = planetaryExtrude(length(p.xy - center) - max(gearModule * 1.05, planetaryPlanetPitch() * 0.26), p.z + thickness * 0.72, thickness * 0.33, min(gearModule * 0.16, 0.35));
    carrier = implicit_union_round(carrier, arm, gearModule * 0.32);
    carrier = implicit_union_round(carrier, pin, gearModule * 0.2);
  }
  return carrier;
}

float sdf(vec3 p) {
  float result = planetaryRingGear(p);
  result = min(result, planetarySunGear(p));
  for (int i = 0; i < 3; i += 1) {
    result = min(result, planetaryPlanetGear(p, float(i)));
  }
  if (showCarrier) {
    result = min(result, planetaryCarrier(p));
  }
  return result;
}


vec3 planetaryPalette(float component, vec3 p, vec3 normal) {
  vec3 color = ringColor;
  if (component > 0.5) {
    color = sunColor;
  }
  if (component >= 1.5) {
    color = planetAColor;
  }
  if (component >= 2.33) {
    color = planetBColor;
  }
  if (component >= 2.66) {
    color = planetCColor;
  }
  if (component >= 3.5) {
    color = carrierColor;
  }
  float toothLine = 0.5 + 0.5 * sin(atan(p.y, p.x) * planetaryRingTeeth());
  float faceLight = smoothstep(0.22, 1.0, abs(normal.z));
  color *= 0.92 + 0.15 * toothLine;
  color = mix(color * 0.72, min(color * 1.18 + vec3(0.05), vec3(1.0)), faceLight);
  return clamp(color, vec3(0.0), vec3(1.0));
}

vec3 color(vec3 p, vec3 normal) {
  float best = planetaryRingGear(p);
  float component = 0.0;

  float sun = planetarySunGear(p);
  if (sun < best) {
    best = sun;
    component = 1.0;
  }

  for (int i = 0; i < 3; i += 1) {
    float planet = planetaryPlanetGear(p, float(i));
    if (planet < best) {
      best = planet;
      component = 2.0 + float(i) * 0.34;
    }
  }

  if (showCarrier) {
    float carrier = planetaryCarrier(p);
    if (carrier < best) {
      component = 4.0;
    }
  }

  return planetaryPalette(component, p, normal);
}
`;

const PLANETARY_MIN_SUN_TEETH = 12;
const PLANETARY_MAX_SUN_TEETH = 30;

function roundedTeeth(value, fallback) {
  const numeric = Number(value);
  return Math.round(Number.isFinite(numeric) ? numeric : fallback);
}

function compatibleSunTeeth(params) {
  const planetTeeth = Math.max(3, roundedTeeth(params.planetTeeth, 12));
  const rawSunTeeth = Math.min(
    Math.max(roundedTeeth(params.sunTeeth, 18), PLANETARY_MIN_SUN_TEETH),
    PLANETARY_MAX_SUN_TEETH
  );
  const candidates = [rawSunTeeth - 1, rawSunTeeth, rawSunTeeth + 1, rawSunTeeth - 2, rawSunTeeth + 2]
    .filter((candidate) => candidate >= PLANETARY_MIN_SUN_TEETH && candidate <= PLANETARY_MAX_SUN_TEETH)
    .filter((candidate) => (candidate + planetTeeth) % 3 === 0);
  return candidates.length ? candidates[0] : rawSunTeeth;
}

export default {
  schema: "implicit.js/0.1.0",
  name: "planetary gear",
  description: "A shader-parametric planetary gear set with a sun gear, three planet gears, internal ring teeth, and an under-carrier.",
  units: "mm",
  params: {
    sunTeeth: { type: "number", label: "Sun teeth", min: 12, max: 30, step: 1, default: 18 },
    planetTeeth: { type: "number", label: "Planet teeth", min: 8, max: 18, step: 1, default: 12 },
    gearModule: { type: "number", label: "Gear module", min: 1.2, max: 3.2, step: 0.05, default: 2.0, unit: "mm" },
    toothDepth: { type: "number", label: "Tooth depth", min: 0.6, max: 3.6, step: 0.05, default: 1.55, unit: "mm" },
    thickness: { type: "number", label: "Gear thickness", min: 3, max: 12, step: 0.25, default: 6.5, unit: "mm" },
    backlash: { type: "number", label: "Backlash", min: 0, max: 1.4, step: 0.02, default: 0.22, unit: "mm" },
    meshOffset: { type: "number", label: "Mesh spread", min: 0, max: 5, step: 0.05, default: 0, unit: "mm" },
    meshPhase: { type: "number", label: "Drive phase", min: 0, max: 360, step: 1, default: 16, unit: "deg" },
    carrierAngle: { type: "number", label: "Carrier orbit", min: -180, max: 180, step: 1, default: 0, unit: "deg" },
    ringPhase: { type: "number", label: "Ring phase", min: -180, max: 180, step: 1, default: 0, unit: "deg" },
    showCarrier: { type: "boolean", label: "Show carrier", default: true },
    ringColor: { type: "color", label: "Ring color", default: "#00a7ff" },
    sunColor: { type: "color", label: "Sun color", default: "#ffe83d" },
    planetAColor: { type: "color", label: "Planet A", default: "#ff5b2e" },
    planetBColor: { type: "color", label: "Planet B", default: "#d94dff" },
    planetCColor: { type: "color", label: "Planet C", default: "#7cff4f" },
    carrierColor: { type: "color", label: "Carrier color", default: "#8b6cff" }
  },
  animations: {
    meshCycle: {
      label: "Mesh cycle",
      duration: 8,
      loop: true,
      update({ progress, params, set }) {
        const drive = progress * 360;
        const sunTeeth = compatibleSunTeeth(params);
        const planetTeeth = Math.max(3, roundedTeeth(params.planetTeeth, 12));
        const ringTeeth = sunTeeth + planetTeeth * 2;
        const carrier = drive * sunTeeth / Math.max(sunTeeth + ringTeeth, 1);
        set("meshPhase", drive);
        set("carrierAngle", ((carrier + 180) % 360) - 180);
        set("ringPhase", 0);
      }
    },
    explodeMesh: {
      label: "Explode mesh",
      duration: 5.5,
      loop: true,
      update({ progress, set }) {
        const wave = 0.5 - 0.5 * Math.cos(progress * Math.PI * 2);
        set("meshOffset", wave * 4.2);
        set("carrierAngle", -28 + wave * 56);
      }
    }
  },
  bounds: ({ params }) => {
    const sunTeeth = compatibleSunTeeth(params);
    const planetTeeth = Math.max(3, roundedTeeth(params.planetTeeth, 12));
    const ringTeeth = sunTeeth + planetTeeth * 2;
    const spread = Math.max(params.meshOffset, 0);
    const ringPitch = params.gearModule * ringTeeth * 0.5 + spread;
    const ringOuter = ringPitch + params.toothDepth * 2.8 + params.gearModule * 3.4 + 2;
    const z = params.thickness * 0.92 + 5;
    return [[-ringOuter, -ringOuter, -z], [ringOuter, ringOuter, z]];
  },
  render: ({ params }) => ({
    steps: 320,
    epsilon: Math.max(0.005, params.gearModule * 0.0025),
    normalEpsilon: Math.max(0.038, params.gearModule * 0.018),
    stepScale: 0.5,
    maxStep: Math.max(params.gearModule * 0.62, 0.65)
  }),
  glsl: GLSL
};
