import { getBookings } from "@/lib/mock/bookings-and-dashboard";
import { getBoxTypesByCenter, getCenters, getPricingByCenter } from "@/lib/mock/centers-and-pricing";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";

export default async function CenterDetailPage({ params }: { params: Promise<{ centerId: string }> }) {
  const centers = getCenters();
  const { centerId } = await params;

  const center = centers.find((item) => item.id === centerId);
  if (!center) {
    return (
      <section className="admin-placeholder-card">
        Centre introuvable.
      </section>
    );
  }

  const boxTypes = getBoxTypesByCenter(center.id);
  const pricing = getPricingByCenter(center.id);
  const bookings = getBookings().filter((booking) => booking.centerId === center.id);

  return (
    <div>
      <h1 className="admin-page-title">{center.name}</h1>
      <p className="admin-page-description">
        {center.city} • {center.code} • {center.isKostokOwned ? "Kostok" : "Partenaire"}
      </p>

      <section className="admin-placeholder-card" style={{ marginBottom: "1rem" }}>
        <div className="admin-placeholder-title">Résumé centre</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem", marginTop: "0.65rem" }}>
          <div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>Box types</div>
            <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>{boxTypes.length}</div>
          </div>
          <div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>Pricing rows</div>
            <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>{pricing.length}</div>
          </div>
          <div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>Bookings</div>
            <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>{bookings.length}</div>
          </div>
        </div>
      </section>

      <TableWithColumnFilters
        title="Types de box"
        stickyFilters={false}
        data={boxTypes.map((box) => ({
          id: box.id,
          name: box.name,
          size: `${box.sizeM2} m²`,
          basePrice: box.basePrice.toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          }),
        }))}
        columns={[
          { key: "name", label: "Nom", filterType: "text" },
          { key: "size", label: "Surface", filterType: "text" },
          { key: "basePrice", label: "Prix base", filterType: "text" },
        ]}
      />

      <div style={{ marginTop: "1rem" }}>
        <TableWithColumnFilters
          title="Bookings centre"
          stickyFilters={false}
          data={bookings.map((booking) => ({
            id: booking.id,
            bookingId: booking.id,
            status: booking.status,
            source: booking.source,
            amount: booking.amount.toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 2,
            }),
          }))}
          columns={[
            { key: "bookingId", label: "Booking", filterType: "text" },
            {
              key: "status",
              label: "Status",
              filterType: "select",
              selectOptions: [
                { value: "new", label: "new" },
                { value: "confirmed", label: "confirmed" },
                { value: "expired", label: "expired" },
                { value: "cancelled", label: "cancelled" },
              ],
            },
            { key: "source", label: "Source", filterType: "text" },
            { key: "amount", label: "Amount", filterType: "text" },
          ]}
        />
      </div>
    </div>
  );
}
