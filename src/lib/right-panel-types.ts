export type RightPanelRendererType =
  | "text"
  | "formatted"
  | "badge"
  | "progress"
  | "donut"
  | "link";

export type RightPanelFieldSourceType = "raw" | "computed" | "relation" | "external";

export type RightPanelActionType = "navigate" | "openModal" | "callApi" | "emitEvent" | "copyValue";

export type RightPanelActionLevel = "global" | "local";

export type RightPanelActionDefinition = {
  key: string;
  label: string;
  actionType: RightPanelActionType;
  level: RightPanelActionLevel;
  params?: Record<string, unknown>;
  visibleWhen?: string;
  enabledWhen?: string;
};

export type RightPanelFieldConfig = {
  key: string;
  label: string;
  source: RightPanelFieldSourceType;
  path?: string;
  formulaKey?: string;
  relationKey?: string;
  renderer: RightPanelRendererType;
  format?: Record<string, unknown>;
  actions?: RightPanelActionDefinition[];
};

export type RightPanelSectionConfig = {
  key: string;
  title?: string;
  fields: RightPanelFieldConfig[];
};

export type RightPanelRelationConfig = {
  key: string;
  resolver: string;
  params?: Record<string, unknown>;
};

export type RightPanelFormulaConfig = {
  key: string;
  expression: string;
  dependencies?: string[];
};

export type RightPanelUiOptions = {
  width?: number;
  collapsible?: boolean;
};

export type RightPanelConfig = {
  panelId: string;
  displayName: string;
  titleTemplate: string;
  subtitleTemplate?: string;
  contexts: string[];
  sections: RightPanelSectionConfig[];
  relations?: RightPanelRelationConfig[];
  formulas?: RightPanelFormulaConfig[];
  globalActions?: RightPanelActionDefinition[];
  localActions?: RightPanelActionDefinition[];
  uiOptions?: RightPanelUiOptions;
};

export type RightPanelConfigOverride = Partial<Omit<RightPanelConfig, "panelId">>;
