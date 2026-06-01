export function themeSettingsForMode(mode) {
  const dark = mode === "dark";
  return {
    background: dark
      ? {
          type: "linear",
          solidColor: "#1a1e24",
          linearStart: "#1a1e24",
          linearEnd: "#11151b",
          linearAngle: 145,
          radialInner: "#21262e",
          radialOuter: "#11151b"
        }
      : {
          type: "linear",
          solidColor: "#eceff4",
          linearStart: "#eceff4",
          linearEnd: "#d8dee9",
          linearAngle: 145,
          radialInner: "#f4f6fa",
          radialOuter: "#d8dee9"
        },
    materials: {
      defaultColor: dark ? "#88c0d0" : "#4c6d94",
      fillColors: [dark ? "#88c0d0" : "#4c6d94"],
      overrideSourceColors: false,
      roughness: 0.62,
      metalness: 0.02,
      clearcoat: 0.22
    }
  };
}
