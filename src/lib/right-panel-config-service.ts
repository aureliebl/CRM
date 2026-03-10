import {
  RIGHT_PANEL_REGISTRY,
  RIGHT_PANEL_REGISTRY_BY_ID,
  isRegisteredRightPanel,
} from "@/lib/right-panel-registry";
import { getAllRightPanelConfigOverrides, getRightPanelConfigOverride } from "@/lib/right-panel-config-store";
import type { RightPanelConfig, RightPanelConfigOverride } from "@/lib/right-panel-types";

function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (base === null || typeof base !== "object" || Array.isArray(base)) {
    return override;
  }
  if (override === null || typeof override !== "object" || Array.isArray(override)) {
    return override;
  }

  const output: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override)) {
    const current = output[key];
    output[key] = deepMerge(current, value);
  }
  return output;
}

export function mergeRightPanelConfig(base: RightPanelConfig, override: RightPanelConfigOverride | null): RightPanelConfig {
  if (!override) return base;
  return deepMerge(base, override) as RightPanelConfig;
}

export async function getMergedRightPanelConfig(panelId: string): Promise<RightPanelConfig | null> {
  if (!isRegisteredRightPanel(panelId)) return null;

  const base = RIGHT_PANEL_REGISTRY_BY_ID[panelId];
  const override = await getRightPanelConfigOverride(panelId);
  return mergeRightPanelConfig(base, override);
}

export async function getMergedRightPanelConfigs(): Promise<RightPanelConfig[]> {
  const overrides = await getAllRightPanelConfigOverrides();
  return RIGHT_PANEL_REGISTRY.map((base) => mergeRightPanelConfig(base, overrides[base.panelId] ?? null));
}
