"use client";

import { getComponentsRegistry, getContentBlocksByComponent } from "@/lib/mock/content-and-components";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { useLocale } from "@/lib/use-locale";

export default function ComponentsRegistryPage() {
  const { locale, t } = useLocale();
  const labels =
    locale === "fr"
      ? {
          description:
            "Utilisez cette vue pour repérer rapidement l'ID d'un composant, son chemin dans le code et les textes qui lui sont associés dans le CMS.",
          id: "ID composant",
          name: "Nom",
          descriptionCol: "Description",
          path: "Chemin",
          category: "Catégorie",
          contentKeys: "Clés de contenu",
        }
      : {
          description:
            "Use this view to quickly find a component ID, its code path, and the content keys associated with it in the CMS.",
          id: "Component ID",
          name: "Name",
          descriptionCol: "Description",
          path: "Path",
          category: "Category",
          contentKeys: "Content keys",
        };
  const components = getComponentsRegistry();
  const rows = components.map((component) => ({
    id: component.id,
    name: component.name,
    description: component.description ?? "",
    path: component.path,
    category: component.category,
    blocksText: getContentBlocksByComponent(component.id)
      .map((block) => `${block.key} (${block.language.toUpperCase()})`)
      .join(" · "),
  }));

  return (
    <div>
      <>
        <h1 className="admin-page-title">{t.components_registry_title}</h1>
        <p className="admin-page-description">{t.components_registry_description}</p>
      </>
      <TableWithColumnFilters
        title={t.components_list_title}
        description={labels.description}
        data={rows}
        columns={[
          { key: "id", label: labels.id, filterType: "text" },
          { key: "name", label: labels.name, filterType: "text" },
          { key: "description", label: labels.descriptionCol, filterType: "text" },
          { key: "path", label: labels.path, filterType: "text" },
          {
            key: "category",
            label: labels.category,
            filterType: "select",
            selectOptions: Array.from(new Set(rows.map((r) => r.category))).map((category) => ({
              value: category,
              label: category,
            })),
          },
          { key: "blocksText", label: labels.contentKeys, filterType: "text" },
        ]}
      />
    </div>
  );
}


