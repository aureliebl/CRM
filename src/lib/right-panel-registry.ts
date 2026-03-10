import type { RightPanelConfig } from "@/lib/right-panel-types";

export const RIGHT_PANEL_REGISTRY: ReadonlyArray<RightPanelConfig> = [
  {
    panelId: "acquisition.unfinishedBooking",
    displayName: "Acquisition - Booking non finalise",
    titleTemplate: "{{fullName}}",
    subtitleTemplate: "Lead {{id}}",
    contexts: ["acquisition.unfinished"],
    sections: [
      {
        key: "identity",
        title: "Identite",
        fields: [
          { key: "contact", label: "Contact", source: "raw", path: "fullName", renderer: "text" },
          { key: "email", label: "Email", source: "raw", path: "email", renderer: "text" },
          { key: "phone", label: "Telephone", source: "raw", path: "phone", renderer: "text" },
        ],
      },
      {
        key: "progress",
        title: "Progression",
        fields: [
          { key: "step", label: "Etape", source: "raw", path: "step", renderer: "formatted" },
          {
            key: "stepPct",
            label: "Completion",
            source: "computed",
            formulaKey: "stepCompletion",
            renderer: "progress",
            format: { min: 0, max: 100 },
          },
        ],
      },
    ],
    formulas: [
      {
        key: "stepCompletion",
        expression: "ROUND((step / totalSteps) * 100, 0)",
        dependencies: ["step", "totalSteps"],
      },
    ],
    uiOptions: {
      width: 420,
      collapsible: true,
    },
  },
  {
    panelId: "acquisition.quoteRequest",
    displayName: "Acquisition - Demande de devis",
    titleTemplate: "{{fullName}}",
    subtitleTemplate: "Devis {{id}}",
    contexts: ["acquisition.quotes", "acquisition.abandoned"],
    sections: [
      {
        key: "status",
        title: "Statut",
        fields: [
          { key: "status", label: "Statut", source: "raw", path: "status", renderer: "badge" },
          {
            key: "isConverted",
            label: "Conversion",
            source: "computed",
            formulaKey: "isConverted",
            renderer: "badge",
          },
        ],
      },
    ],
    formulas: [
      {
        key: "isConverted",
        expression: "IF(status == 'accepted', 'Converti', 'En cours')",
        dependencies: ["status"],
      },
    ],
    uiOptions: {
      width: 420,
      collapsible: true,
    },
  },
];

export const RIGHT_PANEL_REGISTRY_BY_ID = Object.freeze(
  Object.fromEntries(RIGHT_PANEL_REGISTRY.map((item) => [item.panelId, item])) as Record<string, RightPanelConfig>
);

export function isRegisteredRightPanel(panelId: string): boolean {
  return panelId in RIGHT_PANEL_REGISTRY_BY_ID;
}
