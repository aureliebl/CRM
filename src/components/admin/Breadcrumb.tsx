import Link from "next/link";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { APP_MATERIAL_SYMBOLS } from "@/lib/material-symbols";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/use-locale";

export function Breadcrumb() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const items = buildBreadcrumbs(pathname || "/dashboard");

  return (
    <nav
      className="admin-breadcrumb"
      aria-label={locale === "fr" ? "Fil d'Ariane" : "Breadcrumb"}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="admin-breadcrumb-item">
            {index > 0 && (
              <span className="admin-breadcrumb-separator" aria-hidden>
                <MaterialSymbol
                  name={APP_MATERIAL_SYMBOLS.actions.chevronRight}
                  size={14}
                  weight={500}
                  opticalSize={20}
                />
              </span>
            )}
            {item.href && !isLast ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

