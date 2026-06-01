import {
  ChevronDown,
  Code2,
  Download,
  Eye,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Search,
  SlidersHorizontal,
  SquarePen,
  Sun,
} from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  animatedImplicitParameterValues,
  normalizeImplicitAnimationElapsed
} from "implicitjs/animation";
import {
  DEFAULT_IMPLICIT_GRAPHICS_SETTINGS,
  IMPLICIT_GRAPHICS_LIMITS,
  normalizeImplicitGraphicsSettings
} from "implicitjs/graphicsSettings";
import { loadImplicitSource } from "implicitjs/loader";
import {
  normalizeParameterValue,
  normalizeParameterValues
} from "implicitjs/common/parameters.js";

import { ScrollArea } from "./components/ui/scroll-area.jsx";
import { themeSettingsForMode } from "./previewTheme.js";

const CodePane = lazy(() => (
  import("./CodePane.jsx").then((module) => ({ default: module.CodePane }))
));
const ImplicitViewport = lazy(() => (
  import("./ImplicitViewport.jsx").then((module) => ({ default: module.ImplicitViewport }))
));

const DEFAULT_TEMPLATE_ID = "mobius-strip";
const BRAND_TITLE = "implicit.js";
const GITHUB_REPO_URL = "https://github.com/earthtojake/implicit.js";
const SOURCE_STORAGE_KEY = "implicitjs:source";
const TEMPLATE_STORAGE_KEY = "implicitjs:template";
const CUSTOM_CODE_STORAGE_KEY = "implicitjs:custom-code";
const THEME_STORAGE_KEY = "implicitjs:theme";
const LAYOUT_STORAGE_KEY = "implicitjs:layout";
const COMPILE_DEBOUNCE_MS = 420;
const EDITOR_BOOT_DELAY_MS = 2800;
const PREVIEW_BOOT_DELAY_MS = 520;
const DEFAULT_LAYOUT_VALUES = Object.freeze({
  largePreviewWidth: 50,
  mediumPreviewWidth: 50,
  mediumPreviewSplit: 50,
  settingsWidth: 260
});
const LAYOUT_LIMITS = Object.freeze({
  largePreviewWidth: { min: 42, max: 58 },
  mediumPreviewWidth: { min: 34, max: 66 },
  mediumPreviewSplit: { min: 32, max: 68 },
  settingsWidth: { min: 220, max: 320 }
});
const MOBILE_TABS = Object.freeze([
  ["preview", "Preview", Eye],
  ["source", "Code", Code2],
  ["controls", "Controls", SlidersHorizontal]
]);
const EMPTY_TEMPLATE_SOURCE = `const GLSL = \`
float sdf(vec3 p) {
  return 1.0;
}
\`;

export default {
  schema: "implicit.js/0.1.0",
  name: "empty implicit",
  units: "mm",
  params: {},
  glsl: GLSL
};
`;

function readLocalStorageItem(key, fallback = "") {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeLocalStorageItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in private or restricted contexts.
  }
}

function removeLocalStorageItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures in private or restricted contexts.
  }
}

function readSessionStorageItem(key, fallback = "") {
  try {
    return sessionStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeSessionStorageItem(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in private or restricted contexts.
  }
}

function removeSessionStorageItem(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures in private or restricted contexts.
  }
}

function isStaleMobiusColorParamSource(source) {
  const text = String(source || "");
  return text.includes('name: "mobius strip"') &&
    text.includes("baseColor") &&
    text.includes("midColor") &&
    text.includes("accentColor") &&
    text.includes("edgeColor");
}

function readStoredSource() {
  const source = readLocalStorageItem(SOURCE_STORAGE_KEY, readSessionStorageItem(SOURCE_STORAGE_KEY));
  return isStaleMobiusColorParamSource(source) ? "" : source;
}

function storeSource(source) {
  writeLocalStorageItem(SOURCE_STORAGE_KEY, source);
}

function readStoredTemplateId() {
  return readLocalStorageItem(TEMPLATE_STORAGE_KEY, readSessionStorageItem(TEMPLATE_STORAGE_KEY));
}

function storeSelectedTemplateId(templateId) {
  if (templateId) {
    writeLocalStorageItem(TEMPLATE_STORAGE_KEY, templateId);
    return;
  }
  removeLocalStorageItem(TEMPLATE_STORAGE_KEY);
  removeSessionStorageItem(TEMPLATE_STORAGE_KEY);
}

function readStoredCustomCode() {
  const source = readLocalStorageItem(CUSTOM_CODE_STORAGE_KEY, readSessionStorageItem(CUSTOM_CODE_STORAGE_KEY));
  return isStaleMobiusColorParamSource(source) ? "" : source;
}

function storeCustomCode(source) {
  writeLocalStorageItem(CUSTOM_CODE_STORAGE_KEY, source);
}

function removeStoredCustomCode() {
  removeLocalStorageItem(CUSTOM_CODE_STORAGE_KEY);
  removeSessionStorageItem(CUSTOM_CODE_STORAGE_KEY);
}

function readStoredThemeMode() {
  return readLocalStorageItem(THEME_STORAGE_KEY, "dark");
}

function storeThemeMode(themeMode) {
  writeLocalStorageItem(THEME_STORAGE_KEY, themeMode);
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.min(Math.max(numeric, min), max);
}

function readClampedNumber(value, fallback, { min, max }) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return clampNumber(numeric, min, max);
}

function createLayoutStorageSnapshot({
  largePreviewWidth = DEFAULT_LAYOUT_VALUES.largePreviewWidth,
  mediumPreviewWidth = DEFAULT_LAYOUT_VALUES.mediumPreviewWidth,
  mediumPreviewSplit = DEFAULT_LAYOUT_VALUES.mediumPreviewSplit,
  settingsWidth = DEFAULT_LAYOUT_VALUES.settingsWidth
} = {}) {
  const normalizedLargePreviewWidth = clampNumber(
    largePreviewWidth,
    LAYOUT_LIMITS.largePreviewWidth.min,
    LAYOUT_LIMITS.largePreviewWidth.max
  );
  const normalizedMediumPreviewSplit = clampNumber(
    mediumPreviewSplit,
    LAYOUT_LIMITS.mediumPreviewSplit.min,
    LAYOUT_LIMITS.mediumPreviewSplit.max
  );
  const normalizedMediumPreviewWidth = clampNumber(
    mediumPreviewWidth,
    LAYOUT_LIMITS.mediumPreviewWidth.min,
    LAYOUT_LIMITS.mediumPreviewWidth.max
  );
  const normalizedSettingsWidth = clampNumber(
    settingsWidth,
    LAYOUT_LIMITS.settingsWidth.min,
    LAYOUT_LIMITS.settingsWidth.max
  );

  return {
    large: {
      code: { width: "remaining" },
      preview: { widthPercent: normalizedLargePreviewWidth },
      controls: { widthPx: normalizedSettingsWidth }
    },
    medium: {
      code: { widthPercent: 100 - normalizedMediumPreviewWidth },
      preview: { widthPercent: normalizedMediumPreviewWidth, heightPercent: normalizedMediumPreviewSplit },
      controls: { widthPercent: normalizedMediumPreviewWidth, heightPercent: 100 - normalizedMediumPreviewSplit }
    },
    mobile: {
      code: { widthPercent: 100 },
      preview: { widthPercent: 100 },
      controls: { widthPercent: 100 }
    }
  };
}

function readStoredLayoutSizes() {
  try {
    const rawLayout = sessionStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!rawLayout) {
      return createLayoutStorageSnapshot();
    }
    const layout = JSON.parse(rawLayout);
    return createLayoutStorageSnapshot({
      largePreviewWidth: readClampedNumber(
        layout?.large?.preview?.widthPercent,
        DEFAULT_LAYOUT_VALUES.largePreviewWidth,
        LAYOUT_LIMITS.largePreviewWidth
      ),
      mediumPreviewSplit: readClampedNumber(
        layout?.medium?.preview?.heightPercent,
        DEFAULT_LAYOUT_VALUES.mediumPreviewSplit,
        LAYOUT_LIMITS.mediumPreviewSplit
      ),
      mediumPreviewWidth: readClampedNumber(
        layout?.medium?.preview?.widthPercent,
        DEFAULT_LAYOUT_VALUES.mediumPreviewWidth,
        LAYOUT_LIMITS.mediumPreviewWidth
      ),
      settingsWidth: readClampedNumber(
        layout?.large?.controls?.widthPx,
        DEFAULT_LAYOUT_VALUES.settingsWidth,
        LAYOUT_LIMITS.settingsWidth
      )
    });
  } catch {
    return createLayoutStorageSnapshot();
  }
}

function writeStoredLayoutSizes(layoutSizes) {
  try {
    sessionStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutSizes));
  } catch {
    // Ignore storage failures in private or restricted contexts.
  }
}

function useDebouncedValue(value, delayMs) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}

function compileSummary(model) {
  if (!model) {
    return [];
  }
  const formatNumber = (value) => Number(value || 0).toFixed(Math.abs(value) >= 10 ? 1 : 2);
  return [
    { label: "steps", value: model.maxSteps },
    { label: "bounds", value: model.boundsSource || "declared" },
    { label: "radius", value: formatNumber(model.radius) },
    { label: "params", value: model.parameters?.length || 0 }
  ];
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || "");
}

function compileErrorKind(message, fallback = "javascript") {
  return String(message || "").startsWith("GLSL compile error") ? "glsl" : fallback;
}

function lineColumnForOffset(source, offset) {
  const text = String(source || "");
  const target = Math.max(Math.min(Number(offset) || 0, text.length), 0);
  let line = 1;
  let column = 1;
  for (let index = 0; index < target; index += 1) {
    if (text[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

async function assertJavaScriptSyntax(source, signal) {
  const { javascriptLanguage } = await import("@codemirror/lang-javascript");
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }

  const tree = javascriptLanguage.parser.parse(source);
  const cursor = tree.cursor();
  do {
    if (cursor.type.isError) {
      const { line, column } = lineColumnForOffset(source, cursor.from);
      throw new Error(`JavaScript syntax error at line ${line}, column ${column}.`);
    }
  } while (cursor.next());
}

async function assertImplicitGlslCompiles(model, signal) {
  const source = String(model?.glslSource || model?.distanceSource || "").trim();
  if (!source) {
    return;
  }
  const { implicitSdfEvaluatorInternals } = await import("implicitjs/sdfEvaluator");
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }

  const { Parser, tokenize } = implicitSdfEvaluatorInternals;
  try {
    const program = new Parser(tokenize(`
${source}

float implicit_distance(vec3 p) {
  return sdf(p);
}
`)).parseProgram();
    if (!program.functions.has("sdf")) {
      throw new Error("Implicit CAD GLSL source did not define sdf(vec3 p).");
    }
  } catch (error) {
    throw new Error(`GLSL compile error: ${errorMessage(error)}`);
  }
}

function safeFileStem(value, fallback = "implicit-model") {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

async function fetchTemplateSource(template) {
  const response = await fetch(`/examples/${template.file}?v=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Could not load ${template.file}`);
  }
  return response.text();
}

function downloadExport(result, filename) {
  const blob = result.body instanceof Blob
    ? result.body
    : new Blob([result.body], { type: result.contentType || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let exportWorkerMessageId = 0;

function exportImplicitModelInWorker(job) {
  if (typeof Worker === "undefined") {
    return Promise.reject(new Error("This browser does not support worker exports."));
  }
  const worker = new Worker(new URL("./exportWorker.js", import.meta.url), {
    name: "implicitjs-export-worker",
    type: "module"
  });
  const id = exportWorkerMessageId + 1;
  exportWorkerMessageId = id;

  return new Promise((resolve, reject) => {
    function cleanup() {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      worker.removeEventListener("messageerror", onMessageError);
      worker.terminate();
    }
    function onMessage(event) {
      const data = event.data || {};
      if (data.id !== id) {
        return;
      }
      cleanup();
      if (data.ok) {
        resolve(data.result);
        return;
      }
      reject(new Error(data.error || "Export failed in worker."));
    }
    function onError(event) {
      cleanup();
      reject(new Error(event.message || "Export worker failed."));
    }
    function onMessageError() {
      cleanup();
      reject(new Error("Export worker returned an unreadable result."));
    }
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.addEventListener("messageerror", onMessageError);
    try {
      worker.postMessage({ id, job });
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error(errorMessage(error)));
    }
  });
}

function IconButton({ children, title, className = "", ...props }) {
  return (
    <button className={`icon-button ${className}`} title={title} aria-label={title} {...props}>
      {children}
    </button>
  );
}

function IconLink({ children, title, className = "", ...props }) {
  return (
    <a className={`icon-button ${className}`} title={title} aria-label={title} {...props}>
      {children}
    </a>
  );
}

function GitHubMark({ size = 14 }) {
  return (
    <svg aria-hidden="true" focusable="false" height={size} viewBox="0 0 24 24" width={size}>
      <path
        d="M12 2C6.48 2 2 6.58 2 12.22c0 4.51 2.87 8.33 6.84 9.68.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.39 9.39 0 0 1 12 6.91c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.81 0 .27.18.59.69.49A10.12 10.12 0 0 0 22 12.22C22 6.58 17.52 2 12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DownloadMenu({ className = "", exportDisabled, onDownloadPng, onDownloadSource, onExport }) {
  const closeMenu = (event) => {
    event.currentTarget.closest("details").open = false;
  };

  return (
    <details className={`nav-menu download-menu ${className}`}>
      <summary
        aria-label="Downloads"
        className="nav-menu-trigger"
        title="Downloads"
      >
        <Download size={14} />
      </summary>
      <div className="nav-menu-content" role="menu">
        <button
          role="menuitem"
          type="button"
          onClick={(event) => {
            closeMenu(event);
            onDownloadSource();
          }}
        >
          Source
        </button>
        <button
          disabled={exportDisabled}
          role="menuitem"
          type="button"
          onClick={(event) => {
            closeMenu(event);
            onDownloadPng();
          }}
        >
          PNG
        </button>
        {[
          ["glb", "GLB"],
          ["3mf", "3MF"],
          ["stl", "STL"]
        ].map(([format, label]) => (
          <button
            disabled={exportDisabled}
            key={format}
            role="menuitem"
            type="button"
            onClick={(event) => {
              closeMenu(event);
              onExport(format);
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </details>
  );
}

function ExamplesDropdown({ templates, selectedTemplateId, onTemplateChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const detailsRef = useRef(null);
  const searchRef = useRef(null);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const selectedLabel = selectedTemplate?.label || "Examples";
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTemplates = useMemo(() => {
    if (!normalizedQuery) {
      return templates;
    }
    return templates.filter((template) => (
      `${template.label || ""} ${template.id || ""} ${template.description || ""}`
        .toLowerCase()
        .includes(normalizedQuery)
    ));
  }, [normalizedQuery, templates]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handlePointerDown = (event) => {
      if (detailsRef.current?.contains(event.target)) {
        return;
      }
      if (detailsRef.current) {
        detailsRef.current.open = false;
      }
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const closeMenu = useCallback(() => {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
    setOpen(false);
    setQuery("");
  }, []);

  const handleToggle = useCallback(() => {
    const nextOpen = Boolean(detailsRef.current?.open);
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      return;
    }
    window.requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  const handleSelectTemplate = useCallback((templateId) => {
    closeMenu();
    onTemplateChange(templateId);
  }, [closeMenu, onTemplateChange]);

  return (
    <details className="nav-menu examples-menu" onToggle={handleToggle} ref={detailsRef}>
      <summary
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Examples"
        className="nav-menu-trigger examples-menu-trigger"
        title="Examples"
      >
        <span className="examples-menu-label">{selectedLabel}</span>
        <ChevronDown aria-hidden="true" size={13} />
      </summary>
      <div className="nav-menu-content examples-menu-content" onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeMenu();
        }
      }}>
        <label className="examples-search-field">
          <Search aria-hidden="true" size={13} />
          <input
            aria-label="Search examples"
            placeholder="Search examples"
            ref={searchRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div aria-label="Examples" className="examples-options" role="listbox">
          {filteredTemplates.length ? filteredTemplates.map((template) => (
            <button
              aria-selected={template.id === selectedTemplateId}
              className={template.id === selectedTemplateId ? "is-selected" : ""}
              key={template.id}
              role="option"
              type="button"
              onClick={() => handleSelectTemplate(template.id)}
            >
              {template.label}
            </button>
          )) : (
            <div className="examples-empty" role="status">No examples</div>
          )}
        </div>
      </div>
    </details>
  );
}

function FieldLabel({ children }) {
  return <span className="field-label">{children}</span>;
}

function SectionTitle({ children, icon = null }) {
  return (
    <div className="section-bar">
      <div className="section-title-row">
        {icon}
        <span>{children}</span>
      </div>
    </div>
  );
}

function SplitHandle({ axis, className = "", onPointerDown, title }) {
  return (
    <div
      className={`split-handle split-${axis} ${className}`}
      role="separator"
      tabIndex={0}
      title={title}
      aria-label={title}
      onPointerDown={onPointerDown}
    />
  );
}

function PreviewLoading({ label = "Loading preview" }) {
  return (
    <div className="viewport-loading" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function PreviewLoadingHost({ label }) {
  return (
    <div className="viewport-canvas-host">
      <PreviewLoading label={label} />
    </div>
  );
}

function SourcePaneFallback({
  active = false,
  onActivateEditor,
  value,
  onChange
}) {
  return (
    <section className={`code-pane mobile-panel ${active ? "is-active" : ""}`}>
      <SectionTitle icon={<Code2 size={14} />}>Code</SectionTitle>
      <div className="code-pane-body">
        <textarea
          aria-label="implicit.js source"
          className="source-lite-editor"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          onFocus={onActivateEditor}
        />
      </div>
    </section>
  );
}

function beginSplitDrag(event, {
  axis,
  containerRef,
  max = 78,
  min = 22,
  setValue
}) {
  const container = containerRef.current;
  if (!container) {
    return;
  }
  event.preventDefault();
  const rect = container.getBoundingClientRect();
  document.documentElement.classList.add("is-resizing");

  const update = (pointerEvent) => {
    const raw = axis === "x"
      ? ((pointerEvent.clientX - rect.left) / Math.max(rect.width, 1)) * 100
      : ((pointerEvent.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
    setValue(clampNumber(raw, min, max));
  };
  const stop = () => {
    document.documentElement.classList.remove("is-resizing");
    window.removeEventListener("pointermove", update);
    window.removeEventListener("pointerup", stop);
  };

  update(event);
  window.addEventListener("pointermove", update);
  window.addEventListener("pointerup", stop, { once: true });
}

function beginLargePreviewDrag(event, {
  containerRef,
  settingsWidth,
  max = 58,
  min = 42,
  setValue
}) {
  const container = containerRef.current;
  if (!container) {
    return;
  }
  event.preventDefault();
  const rect = container.getBoundingClientRect();
  document.documentElement.classList.add("is-resizing");

  const update = (pointerEvent) => {
    const separatorWidth = 12;
    const raw = ((rect.right - pointerEvent.clientX - settingsWidth - separatorWidth) / Math.max(rect.width, 1)) * 100;
    setValue(clampNumber(raw, min, max));
  };
  const stop = () => {
    document.documentElement.classList.remove("is-resizing");
    window.removeEventListener("pointermove", update);
    window.removeEventListener("pointerup", stop);
  };

  update(event);
  window.addEventListener("pointermove", update);
  window.addEventListener("pointerup", stop, { once: true });
}

function beginTrailingPercentDrag(event, {
  containerRef,
  max = 66,
  min = 34,
  setValue
}) {
  const container = containerRef.current;
  if (!container) {
    return;
  }
  event.preventDefault();
  const rect = container.getBoundingClientRect();
  document.documentElement.classList.add("is-resizing");

  const update = (pointerEvent) => {
    const raw = ((rect.right - pointerEvent.clientX) / Math.max(rect.width, 1)) * 100;
    setValue(clampNumber(raw, min, max));
  };
  const stop = () => {
    document.documentElement.classList.remove("is-resizing");
    window.removeEventListener("pointermove", update);
    window.removeEventListener("pointerup", stop);
  };

  update(event);
  window.addEventListener("pointermove", update);
  window.addEventListener("pointerup", stop, { once: true });
}

function beginTrailingPixelDrag(event, {
  containerRef,
  max = 320,
  min = 220,
  setValue
}) {
  const container = containerRef.current;
  if (!container) {
    return;
  }
  event.preventDefault();
  const rect = container.getBoundingClientRect();
  document.documentElement.classList.add("is-resizing");

  const update = (pointerEvent) => {
    const raw = rect.right - pointerEvent.clientX;
    setValue(clampNumber(raw, min, max));
  };
  const stop = () => {
    document.documentElement.classList.remove("is-resizing");
    window.removeEventListener("pointermove", update);
    window.removeEventListener("pointerup", stop);
  };

  update(event);
  window.addEventListener("pointermove", update);
  window.addEventListener("pointerup", stop, { once: true });
}

function ParameterControl({ parameter, value, onChange, animatedValue }) {
  const displayValue = animatedValue ?? value;
  if (parameter.type === "boolean") {
    return (
      <label className="toggle-row">
        <span>
          <FieldLabel>{parameter.label}</FieldLabel>
          {parameter.description ? <small>{parameter.description}</small> : null}
        </span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(parameter.id, event.target.checked)}
        />
      </label>
    );
  }
  if (parameter.type === "color") {
    return (
      <label className="control-row">
        <span className="control-head">
          <FieldLabel>{parameter.label}</FieldLabel>
          <code>{String(displayValue)}</code>
        </span>
        <input type="color" value={value} onChange={(event) => onChange(parameter.id, event.target.value)} />
      </label>
    );
  }
  if (parameter.type === "enum") {
    return (
      <label className="control-row">
        <FieldLabel>{parameter.label}</FieldLabel>
        <select value={value} onChange={(event) => onChange(parameter.id, event.target.value)}>
          {parameter.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    );
  }
  const min = Number(parameter.min);
  const max = Number(parameter.max);
  const step = Number(parameter.step) || 0.01;
  const numericDisplayValue = Number(displayValue || 0);
  return (
    <label className="control-row">
      <span className="control-head">
        <FieldLabel>{parameter.label}</FieldLabel>
        <code>{numericDisplayValue.toFixed(step >= 1 ? 0 : 2)}{parameter.unit ? ` ${parameter.unit}` : ""}</code>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numericDisplayValue}
        onChange={(event) => onChange(parameter.id, Number(event.target.value))}
      />
    </label>
  );
}

function GraphicsControl({ id, label, value, onChange }) {
  const limits = IMPLICIT_GRAPHICS_LIMITS[id];
  return (
    <label className="control-row">
      <span className="control-head">
        <FieldLabel>{label}</FieldLabel>
        <code>{Number(value).toFixed(2)}</code>
      </span>
      <input
        type="range"
        min={limits.min}
        max={limits.max}
        step={limits.step}
        value={value}
        onChange={(event) => onChange(id, Number(event.target.value))}
      />
    </label>
  );
}

function NumberControl({ label, value, min, max, step = 1, unit = "", onChange }) {
  const numericValue = Number(value);
  return (
    <label className="control-row">
      <span className="control-head">
        <FieldLabel>{label}</FieldLabel>
        <code>{Number.isFinite(numericValue) ? numericValue.toFixed(step >= 1 ? 0 : 2) : value}{unit ? ` ${unit}` : ""}</code>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function InspectorPanel({
  model,
  definition,
  paramValues,
  animatedValues,
  onParamChange,
  graphics,
  onGraphicsChange,
  activeAnimationId,
  onAnimationChange,
  playing,
  onTogglePlaying,
  onResetAnimation,
  exportSettings,
  onExportSettingChange,
  sourceError = ""
}) {
  const parameters = definition?.parameters || [];
  const animations = definition?.animations || [];
  const summary = compileSummary(model);

  return (
    <aside className="inspector">
      <SectionTitle icon={<SlidersHorizontal size={14} />}>Controls</SectionTitle>

      <ScrollArea className="inspector-scroll">
        <div className="inspector-content">
          <div className="stat-grid">
            {summary.map((item) => (
              <div className="stat-cell" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          {sourceError ? (
            <div className="inspector-source-error" role="alert">
              <FieldLabel>javascript error</FieldLabel>
              <p>{sourceError}</p>
            </div>
          ) : null}

          {animations.length ? (
            <section className="control-section">
              <div className="section-title">animation</div>
              <div className="animation-row">
                <select value={activeAnimationId} onChange={(event) => onAnimationChange(event.target.value)}>
                  {animations.map((animation) => (
                    <option key={animation.id} value={animation.id}>{animation.label}</option>
                  ))}
                </select>
                <IconButton title={playing ? "Pause animation" : "Play animation"} onClick={onTogglePlaying}>
                  {playing ? <Pause size={16} /> : <Play size={16} />}
                </IconButton>
                <IconButton title="Reset animation" onClick={onResetAnimation}>
                  <RotateCcw size={16} />
                </IconButton>
              </div>
            </section>
          ) : null}

          {parameters.length ? (
            <section className="control-section">
              <div className="section-title">parameters</div>
              <div className="control-stack">
                {parameters.map((parameter) => (
                  <ParameterControl
                    key={parameter.id}
                    parameter={parameter}
                    value={paramValues[parameter.id]}
                    animatedValue={animatedValues[parameter.id]}
                    onChange={onParamChange}
                  />
                ))}
              </div>
            </section>
          ) : (
            <section className="control-section">
              <div className="section-title">parameters</div>
              <p className="muted-copy">This implicit module has no exposed params.</p>
            </section>
          )}

          <section className="control-section">
            <div className="section-title">export</div>
            <div className="control-stack">
              <NumberControl
                label="mesh resolution"
                min={24}
                max={192}
                step={4}
                value={exportSettings.resolution}
                onChange={(value) => onExportSettingChange("resolution", value)}
              />
            </div>
          </section>

          <section className="control-section">
            <div className="section-title">graphics</div>
            <div className="control-stack">
              <GraphicsControl id="resolutionScale" label="idle resolution" value={graphics.resolutionScale} onChange={onGraphicsChange} />
              <GraphicsControl id="interactionResolutionScale" label="drag resolution" value={graphics.interactionResolutionScale} onChange={onGraphicsChange} />
              <GraphicsControl id="detail" label="ray detail" value={graphics.detail} onChange={onGraphicsChange} />
              <GraphicsControl id="normalSmoothing" label="normal smoothing" value={graphics.normalSmoothing} onChange={onGraphicsChange} />
              {[
                ["modelColors", "model colors"],
                ["shadows", "soft shadows"],
                ["ambientOcclusion", "ambient occlusion"],
                ["rimLight", "rim light"]
              ].map(([id, label]) => (
                <label className="toggle-row" key={id}>
                  <span><FieldLabel>{label}</FieldLabel></span>
                  <input type="checkbox" checked={Boolean(graphics[id])} onChange={(event) => onGraphicsChange(id, event.target.checked)} />
                </label>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </aside>
  );
}

export default function App() {
  const initialCustomCodeRef = useRef(readStoredCustomCode());
  const initialSourceRef = useRef(initialCustomCodeRef.current || readStoredSource());
  const initialLayoutSizesRef = useRef(readStoredLayoutSizes());
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => (
    initialCustomCodeRef.current
      ? ""
      : (initialSourceRef.current.trim() ? readStoredTemplateId() : DEFAULT_TEMPLATE_ID)
  ));
  const [code, setCode] = useState(() => initialSourceRef.current);
  const [loadedTemplateCode, setLoadedTemplateCode] = useState(() => (
    initialCustomCodeRef.current ? "" : initialSourceRef.current
  ));
  const [compileState, setCompileState] = useState("loading");
  const [compileError, setCompileError] = useState("");
  const [compileErrorType, setCompileErrorType] = useState("");
  const [compiledModel, setCompiledModel] = useState(null);
  const [definition, setDefinition] = useState(null);
  const [paramValues, setParamValues] = useState({});
  const [graphics, setGraphics] = useState(() => normalizeImplicitGraphicsSettings(DEFAULT_IMPLICIT_GRAPHICS_SETTINGS));
  const [exportSettings, setExportSettings] = useState({ resolution: 72 });
  const [exportState, setExportState] = useState({ status: "idle", message: "" });
  const [activeAnimationId, setActiveAnimationId] = useState("");
  const [playing, setPlaying] = useState(false);
  const [animationElapsed, setAnimationElapsed] = useState(0);
  const [themeMode, setThemeMode] = useState(readStoredThemeMode);
  const [mobileTab, setMobileTab] = useState("preview");
  const [editorBooted, setEditorBooted] = useState(false);
  const [previewBooted, setPreviewBooted] = useState(false);
  const [largePreviewWidth, setLargePreviewWidth] = useState(
    () => initialLayoutSizesRef.current.large.preview.widthPercent
  );
  const [settingsWidth, setSettingsWidth] = useState(
    () => initialLayoutSizesRef.current.large.controls.widthPx
  );
  const [mediumPreviewWidth, setMediumPreviewWidth] = useState(
    () => initialLayoutSizesRef.current.medium.preview.widthPercent
  );
  const [mediumPreviewSplit, setMediumPreviewSplit] = useState(
    () => initialLayoutSizesRef.current.medium.preview.heightPercent
  );
  const workspaceRef = useRef(null);
  const previewViewportRef = useRef(null);
  const templatesRef = useRef([]);
  const resetParamsForSourceRef = useRef("");
  const debouncedCode = useDebouncedValue(code, COMPILE_DEBOUNCE_MS);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");
    storeThemeMode(themeMode);
  }, [themeMode]);

  useEffect(() => {
    storeSource(code);
    if (!selectedTemplateId && code !== loadedTemplateCode) {
      storeCustomCode(code);
      return;
    }
    removeStoredCustomCode();
  }, [code, loadedTemplateCode, selectedTemplateId]);

  useEffect(() => {
    writeStoredLayoutSizes(createLayoutStorageSnapshot({
      largePreviewWidth,
      mediumPreviewWidth,
      mediumPreviewSplit,
      settingsWidth
    }));
  }, [largePreviewWidth, mediumPreviewSplit, mediumPreviewWidth, settingsWidth]);

  useEffect(() => {
    if (editorBooted) {
      return undefined;
    }
    let cancelled = false;
    const shouldBootEditor = () => (
      mobileTab === "source" ||
      !window.matchMedia("(max-width: 760px)").matches
    );
    const bootEditor = () => {
      if (!cancelled && shouldBootEditor()) {
        setEditorBooted(true);
      }
    };

    if (!shouldBootEditor()) {
      return () => {
        cancelled = true;
      };
    }
    const timeoutId = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(bootEditor, { timeout: 1500 });
        return;
      }
      bootEditor();
    }, EDITOR_BOOT_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [editorBooted, mobileTab]);

  useEffect(() => {
    let cancelled = false;
    let idleId = 0;
    const bootPreview = () => {
      if (!cancelled) {
        setPreviewBooted(true);
      }
    };

    const timeoutId = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(bootPreview, { timeout: 900 });
        return;
      }
      bootPreview();
    }, PREVIEW_BOOT_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      if (idleId && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);

  const loadTemplate = useCallback(async (templateId, templateList) => {
    const list = Array.isArray(templateList) && templateList.length
      ? templateList
      : templatesRef.current;
    const template = list.find((candidate) => candidate.id === templateId) || list[0];
    if (!template) {
      return;
    }
    setSelectedTemplateId(template.id);
    storeSelectedTemplateId(template.id);
    setCompileState("loading");
    setCompileError("");
    setCompileErrorType("");
    setParamValues({});
    setActiveAnimationId("");
    const source = await fetchTemplateSource(template);
    resetParamsForSourceRef.current = source;
    setLoadedTemplateCode(source);
    setCode(source);
    setPlaying(false);
    setAnimationElapsed(0);
    setExportState({ status: "idle", message: "" });
  }, []);

  const handleSourceChange = useCallback((source) => {
    setCode(source);
    if (source !== loadedTemplateCode) {
      resetParamsForSourceRef.current = "";
      setSelectedTemplateId("");
      storeSelectedTemplateId("");
    }
  }, [loadedTemplateCode]);

  useEffect(() => {
    let cancelled = false;
    fetch("/examples/index.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Example manifest was not found.");
        }
        return response.json();
      })
      .then(async (manifest) => {
        if (cancelled) {
          return;
        }
        const list = Array.isArray(manifest) ? manifest : [];
        templatesRef.current = list;
        setTemplates(list);
        if (initialCustomCodeRef.current) {
          setSelectedTemplateId("");
          storeSelectedTemplateId("");
          return;
        }
        if (!initialSourceRef.current.trim()) {
          await loadTemplate(DEFAULT_TEMPLATE_ID, list);
          return;
        }

        const storedTemplateId = readStoredTemplateId();
        const storedTemplate = list.find((template) => template.id === storedTemplateId);
        if (storedTemplate) {
          await loadTemplate(storedTemplate.id, list);
          return;
        }

        const defaultTemplate = list.find((template) => template.id === DEFAULT_TEMPLATE_ID);
        if (defaultTemplate) {
          const source = await fetchTemplateSource(defaultTemplate);
          if (!cancelled && source === initialSourceRef.current) {
            setLoadedTemplateCode(source);
            setSelectedTemplateId(defaultTemplate.id);
            storeSelectedTemplateId(defaultTemplate.id);
            return;
          }
        }
        setSelectedTemplateId("");
        setLoadedTemplateCode("");
        storeSelectedTemplateId("");
      })
      .catch((error) => {
        if (!cancelled) {
          setCompileState("error");
          const message = errorMessage(error);
          setCompileError(message);
          setCompileErrorType(compileErrorKind(message));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadTemplate]);

  useEffect(() => {
    if (!debouncedCode.trim()) {
      setCompiledModel(null);
      setDefinition(null);
      setCompileState("idle");
      setCompileErrorType("");
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    let compilePhase = "javascript";
    setCompileState("compiling");
    setCompileError("");
    setCompileErrorType("");

    const compileSource = async () => {
      await assertJavaScriptSyntax(debouncedCode, controller.signal);
      const model = await loadImplicitSource(debouncedCode, {
        signal: controller.signal,
        sourceUrl: "editor://implicit.implicit.js"
      });
      compilePhase = "glsl";
      await assertImplicitGlslCompiles(model, controller.signal);
      if (cancelled) {
        return;
      }
      const nextDefinition = model.definition || null;
      const shouldResetParams = resetParamsForSourceRef.current === debouncedCode;
      if (shouldResetParams) {
        resetParamsForSourceRef.current = "";
      }
      setCompiledModel(model);
      setDefinition(nextDefinition);
      setParamValues((previousValues) => nextDefinition
        ? normalizeParameterValues(nextDefinition, shouldResetParams ? {} : previousValues)
        : {});
      setActiveAnimationId((previousId) => {
        const animations = nextDefinition?.animations || [];
        return animations.some((animation) => animation.id === previousId)
          ? previousId
          : animations[0]?.id || "";
      });
      setCompileState("ready");
      setCompileErrorType("");
      setExportState((current) => current.status === "error" ? { status: "idle", message: "" } : current);
    };

    compileSource().catch((error) => {
      if (cancelled || error?.name === "AbortError") {
        return;
      }
      setCompiledModel(null);
      setDefinition(null);
      setCompileState("error");
      const message = errorMessage(error);
      setCompileError(message);
      setCompileErrorType(compileErrorKind(message, compilePhase));
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedCode]);

  useEffect(() => {
    if (!playing) {
      return undefined;
    }
    let rafId = 0;
    let previousTime = performance.now();
    const tick = (time) => {
      const delta = Math.min(Math.max((time - previousTime) / 1000, 0), 0.1);
      previousTime = time;
      setAnimationElapsed((elapsed) => elapsed + delta);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [playing]);

  const activeAnimation = useMemo(() => {
    const animations = definition?.animations || [];
    return animations.find((animation) => animation.id === activeAnimationId) || animations[0] || null;
  }, [activeAnimationId, definition]);

  const animatedValues = useMemo(() => (
    activeAnimation && (playing || animationElapsed > 0)
      ? animatedImplicitParameterValues(definition, activeAnimation, paramValues, animationElapsed)
      : normalizeParameterValues(definition, paramValues)
  ), [activeAnimation, animationElapsed, definition, paramValues, playing]);

  const liveResult = useMemo(() => {
    if (!definition) {
      return { model: compiledModel, error: "" };
    }
    try {
      return {
        model: definition.buildModel(animatedValues, {
          activeId: activeAnimation?.id || "",
          playing,
          elapsedSec: normalizeImplicitAnimationElapsed(animationElapsed, activeAnimation),
          speed: 1
        }),
        error: ""
      };
    } catch (error) {
      return {
        model: null,
        error: errorMessage(error)
      };
    }
  }, [activeAnimation, animatedValues, animationElapsed, compiledModel, definition, playing]);
  const liveModel = liveResult.model;
  const previewError = compileState === "error" ? compileError : liveResult.error;
  const controlsSourceError = compileState === "error" && compileErrorType === "javascript" ? compileError : "";
  const previewModel = previewBooted && !previewError ? liveModel : null;

  const handleExportSettingChange = useCallback((id, value) => {
    setExportSettings((current) => ({
      ...current,
      [id]: id === "resolution"
        ? Math.floor(clampNumber(value, 24, 192))
        : value
    }));
  }, []);

  const handleExport = useCallback(async (format) => {
    if (!liveModel || previewError || compileState !== "ready") {
      setExportState({ status: "error", message: "Fix the source before exporting." });
      return;
    }
    setExportState({ status: "busy", message: `building ${format.toUpperCase()}` });
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    try {
      const result = await exportImplicitModelInWorker({
        source: debouncedCode,
        params: animatedValues,
        animationState: {
          activeId: activeAnimation?.id || "",
          playing,
          elapsedSec: normalizeImplicitAnimationElapsed(animationElapsed, activeAnimation),
          speed: 1
        },
        format,
        resolution: exportSettings.resolution,
      });
      const extension = (result.extension || `.${format}`).replace(/^\./, "");
      const filename = `${safeFileStem(result.model?.name || liveModel.name)}.${extension}`;
      downloadExport(result, filename);
      setExportState({
        status: "done",
        message: `${filename} exported`
      });
    } catch (error) {
      setExportState({ status: "error", message: errorMessage(error) });
    }
  }, [activeAnimation, animatedValues, animationElapsed, compileState, debouncedCode, exportSettings.resolution, liveModel, playing, previewError]);

  const handleDownloadPng = useCallback(async () => {
    if (!liveModel || previewError) {
      setExportState({ status: "error", message: "Fix the source before exporting." });
      return;
    }
    setExportState({ status: "busy", message: "rendering PNG" });
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    try {
      const [{ snapshotImplicitCadModel }, THREE] = await Promise.all([
        import("implicitjs/snapshot"),
        import("three")
      ]);
      const previewSnapshot = previewViewportRef.current?.snapshotOptions?.() || {};
      const result = await snapshotImplicitCadModel(THREE, liveModel, {
        width: previewSnapshot.width || 1200,
        height: previewSnapshot.height || 900,
        camera: previewSnapshot.camera || "iso",
        appearance: themeSettingsForMode(themeMode),
        graphics
      });
      const response = await fetch(result.dataUrl);
      const body = await response.blob();
      const filename = `${safeFileStem(liveModel.name)}.png`;
      downloadExport({ body, contentType: result.mimeType }, filename);
      setExportState({
        status: "done",
        message: `${filename} exported`
      });
    } catch (error) {
      setExportState({ status: "error", message: errorMessage(error) });
    }
  }, [graphics, liveModel, previewError, themeMode]);

  const handleParamChange = useCallback((parameterId, value) => {
    setParamValues((currentValues) => {
      const parameter = definition?.parameterMap?.[parameterId];
      if (!parameter) {
        return currentValues;
      }
      return {
        ...currentValues,
        [parameterId]: normalizeParameterValue(parameter, value)
      };
    });
  }, [definition]);

  const handleGraphicsChange = useCallback((id, value) => {
    setGraphics((currentSettings) => normalizeImplicitGraphicsSettings({
      ...currentSettings,
      [id]: value
    }));
  }, []);

  const handleTemplateChange = useCallback((templateId) => {
    if (!templateId) {
      return;
    }
    loadTemplate(templateId).catch((error) => {
      setCompileState("error");
      const message = errorMessage(error);
      setCompileError(message);
      setCompileErrorType(compileErrorKind(message));
    });
  }, [loadTemplate]);

  const handleCreateEmptySource = useCallback(() => {
    setSelectedTemplateId("");
    storeSelectedTemplateId("");
    resetParamsForSourceRef.current = EMPTY_TEMPLATE_SOURCE;
    setLoadedTemplateCode(EMPTY_TEMPLATE_SOURCE);
    setCode(EMPTY_TEMPLATE_SOURCE);
    setPlaying(false);
    setAnimationElapsed(0);
    setParamValues({});
    setActiveAnimationId("");
    setCompileErrorType("");
    setExportState({ status: "idle", message: "" });
  }, []);

  const handleDownloadSource = useCallback(() => {
    const template = templates.find((candidate) => candidate.id === selectedTemplateId);
    const filename = template?.file || `${safeFileStem(liveModel?.name || "implicit-model")}.implicit.js`;
    downloadExport({
      body: code,
      contentType: "text/javascript;charset=utf-8"
    }, filename);
  }, [code, liveModel?.name, selectedTemplateId, templates]);

  const exportDisabled = !liveModel || Boolean(previewError) || compileState !== "ready" || exportState.status === "busy";

  return (
    <div
      className="app-shell"
      style={{
        "--large-preview-width": `${largePreviewWidth}%`,
        "--medium-code-width": `${100 - mediumPreviewWidth}%`,
        "--medium-preview-width": `${mediumPreviewWidth}%`,
        "--settings-width": `${settingsWidth}px`,
        "--medium-preview-split": `${mediumPreviewSplit}%`
      }}
    >
      <header className="top-rail">
        <div className="brand-block compact-brand">
          <img className="brand-mark" src="/favicon.svg" alt="" aria-hidden="true" />
          <strong className="brand-word" aria-label={BRAND_TITLE}>
            {[...BRAND_TITLE].map((character, index) => (
              <span
                aria-hidden="true"
                className="brand-letter"
                key={`${character}-${index}`}
                style={{ "--brand-letter-index": index }}
              >
                {character}
              </span>
            ))}
          </strong>
          <span className="brand-subtitle">model 3d objects with math</span>
        </div>
        <div className="template-actions">
          <ExamplesDropdown
            selectedTemplateId={selectedTemplateId}
            templates={templates}
            onTemplateChange={handleTemplateChange}
          />
          <DownloadMenu
            className="mobile-download-menu"
            exportDisabled={exportDisabled}
            onDownloadPng={handleDownloadPng}
            onDownloadSource={handleDownloadSource}
            onExport={handleExport}
          />
          <IconButton
            className="nav-icon-button"
            title="New empty source"
            onClick={handleCreateEmptySource}
          >
            <SquarePen size={14} />
          </IconButton>
        </div>
        <div className="top-actions">
          <DownloadMenu
            className="desktop-download-menu"
            exportDisabled={exportDisabled}
            onDownloadPng={handleDownloadPng}
            onDownloadSource={handleDownloadSource}
            onExport={handleExport}
          />
          <IconLink
            className="nav-icon-button"
            href={GITHUB_REPO_URL}
            rel="noreferrer"
            target="_blank"
            title="Open GitHub repository"
          >
            <GitHubMark size={14} />
          </IconLink>
          <IconButton
            className="nav-icon-button"
            title={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setThemeMode((mode) => mode === "dark" ? "light" : "dark")}
          >
            {themeMode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </IconButton>
        </div>
      </header>

      <nav className="mobile-tabs" aria-label="Mobile sections">
        {MOBILE_TABS.map(([id, label, Icon]) => (
          <button
            className={mobileTab === id ? "active" : ""}
            key={id}
            type="button"
            onClick={() => setMobileTab(id)}
          >
            <Icon size={13} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <main className="workspace-grid" ref={workspaceRef}>
        <section className="editor-shell">
          {editorBooted ? (
            <Suspense fallback={(
              <SourcePaneFallback
                active={mobileTab === "source"}
                value={code}
                onChange={handleSourceChange}
              />
            )}>
              <CodePane
                active={mobileTab === "source"}
                themeMode={themeMode}
                value={code}
                onChange={handleSourceChange}
              />
            </Suspense>
          ) : (
            <SourcePaneFallback
              active={mobileTab === "source"}
              onActivateEditor={() => setEditorBooted(true)}
              value={code}
              onChange={handleSourceChange}
            />
          )}
        </section>

        <SplitHandle
          axis="x"
          className="workspace-resizer"
          title="Resize editors and preview"
          onPointerDown={(event) => {
            if (window.matchMedia("(min-width: 761px) and (max-width: 1199px)").matches) {
              beginTrailingPercentDrag(event, {
                containerRef: workspaceRef,
                min: LAYOUT_LIMITS.mediumPreviewWidth.min,
                max: LAYOUT_LIMITS.mediumPreviewWidth.max,
                setValue: setMediumPreviewWidth
              });
              return;
            }
            beginLargePreviewDrag(event, {
              containerRef: workspaceRef,
              settingsWidth,
              min: 42,
              max: 58,
              setValue: setLargePreviewWidth
            });
          }}
        />

        <section className={`visual-shell mobile-panel ${mobileTab === "preview" ? "is-active" : ""}`}>
          <section className="viewport-frame">
            <SectionTitle icon={<Eye size={14} />}>Preview</SectionTitle>
            <div className="viewport-canvas-area">
              {previewError ? null : previewBooted ? (
                <Suspense fallback={<PreviewLoadingHost />}>
                  <ImplicitViewport
                    ref={previewViewportRef}
                    model={previewModel}
                    graphics={graphics}
                    themeMode={themeMode}
                  />
                </Suspense>
              ) : (
                <PreviewLoadingHost />
              )}
              {previewError ? (
                <ScrollArea className="compile-error">
                  <div className="compile-error-content">
                    <FieldLabel>{compileState === "error" ? "compile error" : "runtime error"}</FieldLabel>
                    <pre>{previewError}</pre>
                  </div>
                </ScrollArea>
              ) : null}
              {exportState.message ? (
                <div className={`export-toast export-${exportState.status}`}>
                  {exportState.message}
                </div>
              ) : null}
            </div>
          </section>
        </section>

        <SplitHandle
          axis="x"
          className="controls-resizer"
          title="Resize preview and settings"
          onPointerDown={(event) => {
            if (window.matchMedia("(min-width: 761px) and (max-width: 1199px)").matches) {
              beginSplitDrag(event, {
                axis: "y",
                containerRef: workspaceRef,
                min: 32,
                max: 68,
                setValue: setMediumPreviewSplit
              });
              return;
            }
            beginTrailingPixelDrag(event, {
              containerRef: workspaceRef,
              min: 220,
              max: 320,
              setValue: setSettingsWidth
            });
          }}
        />

        <section className={`controls-shell mobile-panel ${mobileTab === "controls" ? "is-active" : ""}`}>
          <InspectorPanel
            model={liveModel}
            definition={definition}
            paramValues={paramValues}
            animatedValues={animatedValues}
            onParamChange={handleParamChange}
            graphics={graphics}
            onGraphicsChange={handleGraphicsChange}
            activeAnimationId={activeAnimation?.id || ""}
            onAnimationChange={(animationId) => {
              setActiveAnimationId(animationId);
              setAnimationElapsed(0);
            }}
            playing={playing}
            onTogglePlaying={() => setPlaying((value) => !value)}
            onResetAnimation={() => {
              setPlaying(false);
              setAnimationElapsed(0);
            }}
            exportSettings={exportSettings}
            onExportSettingChange={handleExportSettingChange}
            sourceError={controlsSourceError}
          />
        </section>
      </main>
    </div>
  );
}
