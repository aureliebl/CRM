export const APP_MATERIAL_SYMBOLS = {
  navigation: {
    dashboard: "dashboard",
    clients: "group",
    pricing: "euro",
    content: "edit_square",
    components: "deployed_code",
    bookings: "inventory_2",
    liveUsers: "monitoring",
    security: "admin_panel_settings",
  },
  actions: {
    add: "add",
    library: "library_books",
    edit: "edit",
    delete: "delete",
    search: "search",
    settings: "settings",
    language: "translate",
    bug: "bug_report",
    phone: "call",
    close: "close",
    back: "arrow_back",
    chevronLeft: "chevron_left",
    chevronRight: "chevron_right",
    addTab: "add_box",
  },
  status: {
    success: "check_circle",
    warning: "warning",
    error: "error",
    info: "info",
  },
} as const;

export type AppMaterialSymbol =
  | (typeof APP_MATERIAL_SYMBOLS.navigation)[keyof typeof APP_MATERIAL_SYMBOLS.navigation]
  | (typeof APP_MATERIAL_SYMBOLS.actions)[keyof typeof APP_MATERIAL_SYMBOLS.actions]
  | (typeof APP_MATERIAL_SYMBOLS.status)[keyof typeof APP_MATERIAL_SYMBOLS.status];
