"use client";

import { useRouter } from "next/navigation";
import { getClients } from "@/lib/mock/clients";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { useLocale } from "@/lib/use-locale";

export default function ClientsPage() {
  const { locale } = useLocale();
  const router = useRouter();
  const clients = getClients();

  const labels = locale === "fr"
    ? {
        pageTitle: "Clients",
        pageDescription:
          "Répertoire client interne. Les lignes sont cliquables pour accéder à la fiche détaillée.",
        tableTitle: "Tableau client",
        tableDescription: "Cliquer sur une ligne ouvre la fiche du client.",
        name: "Nom",
        phone: "Téléphone",
        segment: "Segment",
        status: "Statut",
        statusActive: "Actif",
        statusLead: "Lead",
        statusChurned: "Churned",
      }
    : {
        pageTitle: "Clients",
        pageDescription:
          "Internal client directory. Rows are clickable to open the detailed client profile.",
        tableTitle: "Clients table",
        tableDescription: "Click a row to open the client profile.",
        name: "Name",
        phone: "Phone",
        segment: "Segment",
        status: "Status",
        statusActive: "Active",
        statusLead: "Lead",
        statusChurned: "Churned",
      };

  const rows = clients.map((client) => ({
    ...client,
    sourceLabel: client.segment ?? "—",
  }));

  return (
    <div>
      <h1 className="admin-page-title">{labels.pageTitle}</h1>
      <p className="admin-page-description">{labels.pageDescription}</p>

      <TableWithColumnFilters
        title={labels.tableTitle}
        description={labels.tableDescription}
        data={rows}
        columns={[
          { key: "id", label: "ID", filterType: "text" },
          {
            key: "fullName",
            label: labels.name,
            filterType: "text",
            render: (row) => (
              <button
                type="button"
                onClick={() => router.push(`/clients/${row.id}`)}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  fontWeight: 500,
                  cursor: "pointer",
                  padding: 0,
                  textAlign: "left",
                }}
              >
                {row.fullName}
              </button>
            ),
          },
          { key: "email", label: "Email", filterType: "text" },
          { key: "phone", label: labels.phone, filterType: "text" },
          {
            key: "sourceLabel",
            label: labels.segment,
            filterType: "text",
          },
          {
            key: "status",
            label: labels.status,
            filterType: "select",
            selectOptions: [
              { value: "active", label: labels.statusActive },
              { value: "lead", label: labels.statusLead },
              { value: "churned", label: labels.statusChurned },
            ],
          },
        ]}
      />
    </div>
  );
}
