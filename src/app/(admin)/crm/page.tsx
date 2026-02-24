"use client";

import { useRouter } from "next/navigation";
import { getClients } from "@/lib/mock/clients";
import { getContractsByClient, getUnpaidInvoicesByClient } from "@/lib/mock/crm";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { useLocale } from "@/lib/use-locale";

export default function CrmPage() {
  const { locale } = useLocale();
  const router = useRouter();
  const clients = getClients();

  const rows = clients.map((client) => {
    const contracts = getContractsByClient(client.id);
    const unpaid = getUnpaidInvoicesByClient(client.id);
    const activeContracts = contracts.filter((c) => c.status === "actif").length;
    const impayeContracts = contracts.filter((c) => c.status === "impayé").length;
    const squatteurContracts = contracts.filter((c) => c.status === "squatteur").length;
    const totalUnpaid = unpaid.reduce((s, inv) => s + inv.amount, 0);

    return {
      ...client,
      firstName: client.firstName ?? "",
      lastName: client.lastName ?? "",
      city: client.city ?? "",
      leadSource: client.leadSource ?? "—",
      activeContracts,
      impayeContracts,
      squatteurContracts,
      totalUnpaid,
      alertLevel: squatteurContracts > 0 ? "squatteur" : impayeContracts > 0 ? "impayé" : totalUnpaid > 0 ? "retard" : "ok",
    };
  });

  const fr = locale === "fr";

  return (
    <div>
      <h1 className="admin-page-title">{fr ? "CRM — Fiche client" : "CRM — Client File"}</h1>
      <p className="admin-page-description">
        {fr
          ? "Répertoire CRM complet. Cliquez sur un client pour accéder à sa fiche détaillée avec contrats, communication, transactions et historique."
          : "Full CRM directory. Click a client to access their detailed file with contracts, communication, transactions, and history."}
      </p>

      <TableWithColumnFilters
        title={fr ? "Clients CRM" : "CRM Clients"}
        description={fr ? "Cliquer sur une ligne ouvre la fiche CRM du client." : "Click a row to open the client CRM file."}
        data={rows}
        columns={[
          {
            key: "alertLevel",
            label: "",
            filterType: "select",
            selectOptions: [
              { value: "ok", label: "OK" },
              { value: "retard", label: fr ? "Retard" : "Late" },
              { value: "impayé", label: fr ? "Impayé" : "Unpaid" },
              { value: "squatteur", label: "Squatteur" },
            ],
            render: (row) => {
              if (row.alertLevel === "squatteur") return <MaterialSymbol name="warning" style={{ color: "var(--color-error)", fontSize: 18 }} />;
              if (row.alertLevel === "impayé") return <MaterialSymbol name="error" style={{ color: "var(--color-warning)", fontSize: 18 }} />;
              if (row.alertLevel === "retard") return <MaterialSymbol name="schedule" style={{ color: "var(--color-warning)", fontSize: 18 }} />;
              return <MaterialSymbol name="check_circle" style={{ color: "var(--color-success)", fontSize: 18 }} />;
            },
          },
          {
            key: "fullName",
            label: fr ? "Nom complet" : "Full Name",
            filterType: "text",
            render: (row) => (
              <button
                type="button"
                onClick={() => router.push(`/crm/${row.id}`)}
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
          { key: "phone", label: fr ? "Téléphone" : "Phone", filterType: "text" },
          { key: "city", label: fr ? "Ville" : "City", filterType: "text" },
          {
            key: "segment",
            label: "Segment",
            filterType: "select",
            selectOptions: [
              { value: "B2C", label: "B2C" },
              { value: "B2B", label: "B2B" },
            ],
          },
          {
            key: "status",
            label: fr ? "Statut" : "Status",
            filterType: "select",
            selectOptions: [
              { value: "active", label: fr ? "Actif" : "Active" },
              { value: "lead", label: "Lead" },
              { value: "churned", label: "Churned" },
            ],
          },
          {
            key: "activeContracts",
            label: fr ? "Contrats actifs" : "Active contracts",
            filterType: "number",
          },
          {
            key: "totalUnpaid",
            label: fr ? "Impayé (€)" : "Unpaid (€)",
            filterType: "number",
            render: (row) => (
              <span style={{ color: row.totalUnpaid > 0 ? "var(--color-error)" : undefined, fontWeight: row.totalUnpaid > 0 ? 600 : undefined }}>
                {row.totalUnpaid > 0 ? `${row.totalUnpaid} €` : "—"}
              </span>
            ),
          },
          { key: "leadSource", label: fr ? "Source" : "Source", filterType: "text" },
        ]}
      />
    </div>
  );
}
