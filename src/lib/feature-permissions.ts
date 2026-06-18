export const LEAD_PRIORITIZATION_FEATURE_KEY = "feature:lead-prioritization";

export function isRoutePermissionKey(permissionKey: string): boolean {
  return permissionKey.startsWith("/");
}
