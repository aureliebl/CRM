export type BreadcrumbItem = {
  label: string;
  href?: string;
};

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  clients: "Clients",
  pricing: "Pricing",
  content: "Content",
  "components-registry": "Composants",
  bookings: "Bookings",
  "live-users": "Live users",
  centers: "Centers",
  security: "Admin & Security",
  tabs: "Tabs",
  graphs: "Graphs",
  new: "New",
  edit: "Edit",
};

const NON_LINKABLE_SEGMENTS = new Set(["graphs"]);

export function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const cleaned = pathname.split("?")[0];
  const segments = cleaned.split("/").filter(Boolean);

  const items: BreadcrumbItem[] = [
    {
      label: "Admin",
      href: "/dashboard",
    },
  ];

  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentPath += `/${seg}`;
    const isLast = i === segments.length - 1;

    let label = SEGMENT_LABELS[seg];

    if (!label) {
      if (/^\d+$/.test(seg)) {
        label = `#${seg}`;
      } else {
        label = seg
          .replace(/\[|\]/g, "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
      }
    }

    items.push({
      label,
      href: isLast || NON_LINKABLE_SEGMENTS.has(seg) ? undefined : currentPath,
    });
  }

  return items;
}

