import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  configureImplicitCamera,
  createImplicitFullscreenScene,
  implicitModelShaderKey,
  updateImplicitAppearanceUniforms,
  updateImplicitGraphicsUniforms,
  updateImplicitMaterialUniforms,
  updateImplicitModelUniforms
} from "implicitjs/render";
import { themeSettingsForMode } from "./previewTheme.js";

const IDLE_PIXEL_BUDGET = 1_250_000;
const LOW_QUALITY_PIXEL_BUDGET = 360_000;
const HEAVY_LOW_QUALITY_PIXEL_BUDGET = 650_000;
const LOW_QUALITY_STEP_PIXEL_BUDGET = 14_000_000;
const HEAVY_LOW_QUALITY_STEP_PIXEL_BUDGET = 8_000_000;
const HEAVY_SHADER_SOURCE_LENGTH = 6_500;
const STARTUP_QUALITY_MS = 900;
const BROWSER_WHEEL_ZOOM_FACTOR = 1.25;
const TOUCH_ZOOM_SPEED_SCALE = 0.14;
const MAX_TOUCH_ZOOM_SPEED = 1.8;
const VIEWPORT_FRAME_MARGIN = 1.05;
const VIEWPORT_CAMERA_ZOOM = 1.5;
const SNAPSHOT_MAX_LONG_EDGE = 1800;
const SNAPSHOT_MAX_PIXEL_RATIO = 2;
const LOW_QUALITY_GRAPHICS = {
  resolutionScale: 1.1,
  interactionResolutionScale: 1,
  detail: 0.5,
  normalSmoothing: 0.9,
  shadows: false,
  ambientOcclusion: false
};
const HEAVY_LOW_QUALITY_GRAPHICS = {
  resolutionScale: 1.1,
  interactionResolutionScale: 1,
  detail: 0.3,
  normalSmoothing: 0.8,
  shadows: false,
  ambientOcclusion: false
};

function disposeRuntime(runtime) {
  if (!runtime) {
    return;
  }
  runtime.controls?.dispose?.();
  runtime.fullscreen?.dispose?.();
  runtime.renderer?.dispose?.();
}

function isHeavyModel(model) {
  const sourceLength = String(model?.glslSource || model?.distanceSource || "").length;
  return sourceLength > HEAVY_SHADER_SOURCE_LENGTH || Number(model?.maxSteps || 0) > 240;
}

function modelForViewport(model) {
  if (!model) {
    return null;
  }
  const frameBounds = model.frameBounds?.min && model.frameBounds?.max
    ? model.frameBounds
    : model.bounds?.min && model.bounds?.max
      ? model.bounds
      : null;
  if (frameBounds === model.frameBounds) {
    return model;
  }
  return frameBounds ? { ...model, frameBounds } : model;
}

function isLowQualityRuntime(runtime) {
  return Boolean(runtime?.lowQualityUntil && performance.now() < runtime.lowQualityUntil);
}

function graphicsForRuntime(runtime, graphics) {
  const settings = graphics || {};
  const lowQuality = isLowQualityRuntime(runtime);
  const heavy = isHeavyModel(runtime?.model);
  if (!lowQuality) {
    return settings;
  }
  const caps = heavy ? HEAVY_LOW_QUALITY_GRAPHICS : LOW_QUALITY_GRAPHICS;
  return {
    ...settings,
    resolutionScale: Math.min(Number(settings.resolutionScale) || 1, caps.resolutionScale),
    interactionResolutionScale: Math.min(
      Number(settings.interactionResolutionScale) || 1,
      caps.interactionResolutionScale
    ),
    detail: Math.min(Number(settings.detail) || 1, caps.detail),
    normalSmoothing: Math.min(Number(settings.normalSmoothing) || 1, caps.normalSmoothing),
    shadows: false,
    ambientOcclusion: false
  };
}

function stepBudgetForRuntime(runtime, graphics) {
  const maxSteps = Math.max(Math.floor(Number(runtime?.model?.maxSteps) || 192), 1);
  const pixels = Math.max((runtime?.width || 1) * (runtime?.height || 1), 1);
  const lowQuality = isLowQualityRuntime(runtime);
  const heavy = isHeavyModel(runtime?.model);
  if (!lowQuality) {
    return maxSteps;
  }
  const detail = Math.max(Number(graphics?.detail) || 1, 0.25);
  const pixelStepBudgetBase = heavy ? HEAVY_LOW_QUALITY_STEP_PIXEL_BUDGET : LOW_QUALITY_STEP_PIXEL_BUDGET;
  const pixelStepBudget = pixelStepBudgetBase *
    Math.min(detail, 2) / 1.25;
  const minSteps = heavy ? 10 : 48;
  return Math.max(Math.min(Math.floor(pixelStepBudget / pixels), maxSteps), Math.min(minSteps, maxSteps));
}

function shaderGraphicsForRuntime(runtime, graphics) {
  return {
    ...graphicsForRuntime(runtime, graphics),
    stepBudget: stepBudgetForRuntime(runtime, graphics)
  };
}

function browserProportionalZoomSpeed() {
  const devicePixelRatio = Math.max(Math.floor(window.devicePixelRatio || 1), 1);
  return devicePixelRatio * Math.log(BROWSER_WHEEL_ZOOM_FACTOR) / -Math.log(0.95);
}

function browserZoomSpeed() {
  const wheelZoomSpeed = browserProportionalZoomSpeed();
  const coarsePointer = window.matchMedia?.("(pointer: coarse), (hover: none)")?.matches === true;
  return coarsePointer
    ? Math.min(wheelZoomSpeed * TOUCH_ZOOM_SPEED_SCALE, MAX_TOUCH_ZOOM_SPEED)
    : wheelZoomSpeed;
}

function resizeRuntime(runtime, container, graphics) {
  const runtimeGraphics = graphicsForRuntime(runtime, graphics);
  const rect = container.getBoundingClientRect();
  const cssWidth = Math.max(Math.floor(rect.width), 1);
  const cssHeight = Math.max(Math.floor(rect.height), 1);
  const now = performance.now();
  const lowQuality = runtime.lowQualityUntil && now < runtime.lowQualityUntil;
  const requestedScale = Math.max(
    lowQuality ? runtimeGraphics.interactionResolutionScale : runtimeGraphics.resolutionScale,
    0.25
  );
  const heavy = isHeavyModel(runtime.model);
  const pixelBudget = lowQuality
    ? heavy ? HEAVY_LOW_QUALITY_PIXEL_BUDGET : LOW_QUALITY_PIXEL_BUDGET
    : IDLE_PIXEL_BUDGET;
  const budgetScale = Math.sqrt(pixelBudget / Math.max(cssWidth * cssHeight, 1));
  const scale = Math.max(Math.min(requestedScale, budgetScale), 0.25);
  const width = Math.max(Math.floor(cssWidth * scale), 1);
  const height = Math.max(Math.floor(cssHeight * scale), 1);

  runtime.renderer.setSize(width, height, false);
  runtime.renderer.domElement.style.width = `${cssWidth}px`;
  runtime.renderer.domElement.style.height = `${cssHeight}px`;
  runtime.camera.aspect = width / height;
  runtime.camera.updateProjectionMatrix();
  runtime.width = width;
  runtime.height = height;
}

function renderRuntime(runtime, graphics) {
  if (!runtime?.fullscreen?.material || !runtime?.model) {
    return;
  }
  updateImplicitGraphicsUniforms(
    runtime.fullscreen.material,
    runtime.model,
    shaderGraphicsForRuntime(runtime, graphics)
  );
  updateImplicitMaterialUniforms(
    runtime.fullscreen.material,
    runtime.camera,
    runtime.width || 1,
    runtime.height || 1
  );
  runtime.renderer.render(runtime.fullscreen.scene, runtime.screenCamera);
}

function installOrbitControls(runtime, container, model) {
  runtime.controls?.dispose?.();
  const rect = container.getBoundingClientRect();
  runtime.camera = configureImplicitCamera(
    THREE,
    model,
    Math.max(rect.width, 1),
    Math.max(rect.height, 1),
    "iso",
    { frameMargin: VIEWPORT_FRAME_MARGIN, zoom: VIEWPORT_CAMERA_ZOOM }
  );
  const controls = new OrbitControls(runtime.camera, runtime.renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.zoomSpeed = browserZoomSpeed();
  controls.screenSpacePanning = true;
  controls.target.set(...model.center);
  controls.addEventListener("change", () => {
    runtime.dirtyFrames = Math.max(runtime.dirtyFrames, 2);
  });
  controls.addEventListener("start", () => {
    runtime.dirtyFrames = Math.max(runtime.dirtyFrames, 4);
  });
  controls.addEventListener("end", () => {
    runtime.dirtyFrames = Math.max(runtime.dirtyFrames, 4);
  });
  runtime.controls = controls;
}

function vectorArray(vector) {
  return [
    Number(vector?.x) || 0,
    Number(vector?.y) || 0,
    Number(vector?.z) || 0
  ];
}

function snapshotSizeForContainer(container) {
  const rect = container?.getBoundingClientRect?.();
  const cssWidth = Math.max(Math.floor(rect?.width || 1200), 1);
  const cssHeight = Math.max(Math.floor(rect?.height || 900), 1);
  const pixelRatio = Math.min(
    Math.max(Number(window.devicePixelRatio) || 1, 1),
    SNAPSHOT_MAX_PIXEL_RATIO
  );
  const rawWidth = Math.max(Math.round(cssWidth * pixelRatio), 1);
  const rawHeight = Math.max(Math.round(cssHeight * pixelRatio), 1);
  const longEdge = Math.max(rawWidth, rawHeight);
  const fit = longEdge > SNAPSHOT_MAX_LONG_EDGE
    ? SNAPSHOT_MAX_LONG_EDGE / longEdge
    : 1;
  return {
    width: Math.max(Math.round(rawWidth * fit), 1),
    height: Math.max(Math.round(rawHeight * fit), 1)
  };
}

function snapshotCameraForRuntime(runtime) {
  const camera = runtime?.camera;
  if (!camera) {
    return "iso";
  }
  const target = runtime.controls?.target || new THREE.Vector3(...(runtime.model?.center || [0, 0, 0]));
  return {
    name: "preview",
    position: vectorArray(camera.position),
    target: vectorArray(target),
    up: vectorArray(camera.up),
    zoom: Math.max(Number(camera.zoom) || 1, 0.05)
  };
}

export const ImplicitViewport = forwardRef(function ImplicitViewport({
  emptyMessage = "Loading preview",
  model,
  graphics,
  themeMode = "dark"
}, ref) {
  const containerRef = useRef(null);
  const runtimeRef = useRef(null);
  const latestRef = useRef({ model, graphics, themeMode });
  const themeSettings = useMemo(() => themeSettingsForMode(themeMode), [themeMode]);

  useImperativeHandle(ref, () => ({
    snapshotOptions() {
      return {
        ...snapshotSizeForContainer(containerRef.current),
        camera: snapshotCameraForRuntime(runtimeRef.current)
      };
    }
  }), []);

  useEffect(() => {
    latestRef.current = { model, graphics, themeMode, themeSettings };
  }, [graphics, model, themeMode, themeSettings]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "implicit-canvas";
    container.appendChild(renderer.domElement);

    const screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const runtime = {
      renderer,
      screenCamera,
      camera: null,
      controls: null,
      fullscreen: null,
      model: null,
      shaderKey: "",
      width: 1,
      height: 1,
      dirtyFrames: 2
    };
    runtimeRef.current = runtime;

    const requestRender = (frames = 2) => {
      runtime.dirtyFrames = Math.max(runtime.dirtyFrames, frames);
    };

    const resizeObserver = new ResizeObserver(() => {
      if (runtime.model) {
        resizeRuntime(runtime, container, latestRef.current.graphics);
        requestRender(3);
      }
    });
    resizeObserver.observe(container);

    const animate = () => {
      runtime.rafId = window.requestAnimationFrame(animate);
      const changed = runtime.controls?.update?.() === true;
      if (changed) {
        runtime.dirtyFrames = Math.max(runtime.dirtyFrames, 2);
      }
      if (runtime.lowQualityUntil && performance.now() >= runtime.lowQualityUntil) {
        runtime.lowQualityUntil = 0;
        if (runtime.model) {
          resizeRuntime(runtime, container, latestRef.current.graphics);
          updateImplicitGraphicsUniforms(
            runtime.fullscreen.material,
            runtime.model,
            shaderGraphicsForRuntime(runtime, latestRef.current.graphics)
          );
          runtime.dirtyFrames = Math.max(runtime.dirtyFrames, 2);
        }
      }
      if (runtime.dirtyFrames > 0) {
        runtime.dirtyFrames -= 1;
        renderRuntime(runtime, latestRef.current.graphics);
      }
    };
    runtime.rafId = window.requestAnimationFrame(animate);

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(runtime.rafId);
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      disposeRuntime(runtime);
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    const container = containerRef.current;
    if (!runtime || !container) {
      return;
    }
    if (!model) {
      runtime.model = null;
      runtime.dirtyFrames = 0;
      runtime.renderer.clear();
      return;
    }
    const renderModel = modelForViewport(model);
    const nextShaderKey = implicitModelShaderKey(renderModel);
    const needsScene = !runtime.fullscreen || runtime.shaderKey !== nextShaderKey;
    if (needsScene) {
      runtime.fullscreen?.dispose?.();
      runtime.fullscreen = createImplicitFullscreenScene(THREE, renderModel);
      runtime.shaderKey = nextShaderKey;
    } else {
      updateImplicitModelUniforms(THREE, runtime.fullscreen.material, renderModel);
    }

    if (!runtime.camera || needsScene) {
      installOrbitControls(runtime, container, renderModel);
    }

    runtime.model = renderModel;
    if (needsScene) {
      runtime.lowQualityUntil = performance.now() + STARTUP_QUALITY_MS;
    }
    resizeRuntime(runtime, container, graphics);
    updateImplicitModelUniforms(THREE, runtime.fullscreen.material, renderModel);
    updateImplicitAppearanceUniforms(THREE, runtime.fullscreen.material, renderModel, {
      themeSettings,
      graphicsSettings: graphics
    });
    updateImplicitGraphicsUniforms(
      runtime.fullscreen.material,
      renderModel,
      shaderGraphicsForRuntime(runtime, graphics)
    );
    runtime.dirtyFrames = Math.max(runtime.dirtyFrames, 2);
  }, [graphics, model, themeSettings]);

  return (
    <div className="viewport-canvas-host" ref={containerRef}>
      {!model ? (
        <div className="viewport-loading" role="status" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          <span>{emptyMessage}</span>
        </div>
      ) : null}
    </div>
  );
});
