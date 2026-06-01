import { normalizeParameterValues } from "implicitjs/common/parameters.js";
import { exportImplicitModel } from "implicitjs/exportModel";
import { loadImplicitSource } from "implicitjs/loader";

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || "");
}

function transferableBody(body) {
  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }
  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }
  return new TextEncoder().encode(String(body || ""));
}

function exportModelFromSource({ source, params, animationState, format, resolution }) {
  return loadImplicitSource(source, {
    sourceUrl: "worker://implicit-export.implicit.js"
  }).then((baseModel) => {
    const definition = baseModel.definition || null;
    const model = definition?.buildModel
      ? definition.buildModel(
          normalizeParameterValues(definition, params || baseModel.defaultParameterValues || {}),
          animationState || baseModel.animationState || {}
        )
      : baseModel;
    return exportImplicitModel(model, { format, resolution });
  });
}

self.addEventListener("message", async (event) => {
  const { id, job = {} } = event.data || {};
  try {
    const result = await exportModelFromSource(job);
    const body = transferableBody(result.body);
    self.postMessage({
      id,
      ok: true,
      result: {
        body,
        contentType: result.contentType,
        extension: result.extension,
        format: result.format,
        model: {
          name: result.model?.name || "implicit-model"
        },
        mesh: {
          triangleCount: result.mesh?.triangleCount || 0,
          vertexCount: result.mesh?.vertexCount || 0,
          grid: result.mesh?.grid || null
        }
      }
    }, [body.buffer]);
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: errorMessage(error)
    });
  }
});
