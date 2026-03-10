import { RIGHT_PANEL_REGISTRY_BY_ID } from "@/lib/right-panel-registry";
import type {
  RightPanelActionDefinition,
  RightPanelConfigOverride,
  RightPanelFieldConfig,
  RightPanelRendererType,
} from "@/lib/right-panel-types";

const ALLOWED_RENDERERS = new Set<RightPanelRendererType>([
  "text",
  "formatted",
  "badge",
  "progress",
  "donut",
  "link",
]);

const ALLOWED_ACTION_TYPES = new Set([
  "navigate",
  "openModal",
  "callApi",
  "emitEvent",
  "copyValue",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateAction(action: unknown): action is RightPanelActionDefinition {
  if (!isRecord(action)) return false;
  if (typeof action.key !== "string" || action.key.trim().length === 0) return false;
  if (typeof action.label !== "string" || action.label.trim().length === 0) return false;
  if (typeof action.level !== "string" || (action.level !== "global" && action.level !== "local")) {
    return false;
  }
  if (typeof action.actionType !== "string" || !ALLOWED_ACTION_TYPES.has(action.actionType)) {
    return false;
  }
  return true;
}

function validateField(field: unknown): field is RightPanelFieldConfig {
  if (!isRecord(field)) return false;
  if (typeof field.key !== "string" || field.key.trim().length === 0) return false;
  if (typeof field.label !== "string" || field.label.trim().length === 0) return false;
  if (typeof field.source !== "string") return false;
  if (!["raw", "computed", "relation", "external"].includes(field.source)) return false;
  if (typeof field.renderer !== "string" || !ALLOWED_RENDERERS.has(field.renderer as RightPanelRendererType)) {
    return false;
  }

  if (field.actions !== undefined) {
    if (!Array.isArray(field.actions)) return false;
    if (!field.actions.every((item) => validateAction(item))) return false;
  }

  return true;
}

export function validateRightPanelConfigOverride(
  panelId: string,
  override: unknown
): { ok: true; value: RightPanelConfigOverride } | { ok: false; error: string } {
  if (!(panelId in RIGHT_PANEL_REGISTRY_BY_ID)) {
    return { ok: false, error: "Unknown panel id" };
  }

  if (!isRecord(override)) {
    return { ok: false, error: "Config override must be an object" };
  }

  const allowedKeys = new Set([
    "displayName",
    "titleTemplate",
    "subtitleTemplate",
    "contexts",
    "sections",
    "relations",
    "formulas",
    "globalActions",
    "localActions",
    "uiOptions",
  ]);

  for (const key of Object.keys(override)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: `Unknown config key: ${key}` };
    }
  }

  if (override.displayName !== undefined && typeof override.displayName !== "string") {
    return { ok: false, error: "displayName must be a string" };
  }

  if (override.titleTemplate !== undefined && typeof override.titleTemplate !== "string") {
    return { ok: false, error: "titleTemplate must be a string" };
  }

  if (override.subtitleTemplate !== undefined && typeof override.subtitleTemplate !== "string") {
    return { ok: false, error: "subtitleTemplate must be a string" };
  }

  if (override.contexts !== undefined) {
    if (!Array.isArray(override.contexts) || !override.contexts.every((item) => typeof item === "string")) {
      return { ok: false, error: "contexts must be a string array" };
    }
  }

  if (override.sections !== undefined) {
    if (!Array.isArray(override.sections)) {
      return { ok: false, error: "sections must be an array" };
    }

    for (const section of override.sections) {
      if (!isRecord(section)) return { ok: false, error: "each section must be an object" };
      if (typeof section.key !== "string" || section.key.trim().length === 0) {
        return { ok: false, error: "section.key is required" };
      }
      if (section.title !== undefined && typeof section.title !== "string") {
        return { ok: false, error: "section.title must be a string" };
      }
      if (!Array.isArray(section.fields) || !section.fields.every((field) => validateField(field))) {
        return { ok: false, error: "section.fields contains invalid field config" };
      }
    }
  }

  if (override.formulas !== undefined) {
    if (!Array.isArray(override.formulas)) return { ok: false, error: "formulas must be an array" };
    for (const formula of override.formulas) {
      if (!isRecord(formula)) return { ok: false, error: "each formula must be an object" };
      if (typeof formula.key !== "string" || formula.key.trim().length === 0) {
        return { ok: false, error: "formula.key is required" };
      }
      if (typeof formula.expression !== "string" || formula.expression.trim().length === 0) {
        return { ok: false, error: "formula.expression is required" };
      }
    }
  }

  if (override.relations !== undefined) {
    if (!Array.isArray(override.relations)) return { ok: false, error: "relations must be an array" };
    for (const relation of override.relations) {
      if (!isRecord(relation)) return { ok: false, error: "each relation must be an object" };
      if (typeof relation.key !== "string" || relation.key.trim().length === 0) {
        return { ok: false, error: "relation.key is required" };
      }
      if (typeof relation.resolver !== "string" || relation.resolver.trim().length === 0) {
        return { ok: false, error: "relation.resolver is required" };
      }
    }
  }

  if (override.globalActions !== undefined) {
    if (!Array.isArray(override.globalActions) || !override.globalActions.every((item) => validateAction(item))) {
      return { ok: false, error: "globalActions contains invalid action" };
    }
  }

  if (override.localActions !== undefined) {
    if (!Array.isArray(override.localActions) || !override.localActions.every((item) => validateAction(item))) {
      return { ok: false, error: "localActions contains invalid action" };
    }
  }

  if (override.uiOptions !== undefined) {
    if (!isRecord(override.uiOptions)) return { ok: false, error: "uiOptions must be an object" };
    if (override.uiOptions.width !== undefined && typeof override.uiOptions.width !== "number") {
      return { ok: false, error: "uiOptions.width must be a number" };
    }
    if (override.uiOptions.collapsible !== undefined && typeof override.uiOptions.collapsible !== "boolean") {
      return { ok: false, error: "uiOptions.collapsible must be a boolean" };
    }
  }

  return { ok: true, value: override as RightPanelConfigOverride };
}
