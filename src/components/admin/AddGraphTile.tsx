import Link from "next/link";

interface AddGraphTileProps {
  href: string;
  label: string;
}

export function AddGraphTile({ href, label }: AddGraphTileProps) {
  return (
    <Link
      href={href}
      style={{
        minHeight: "180px",
        border: "2px dashed var(--border-hover)",
        borderRadius: "1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        color: "var(--text-secondary)",
        background: "var(--card-bg)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            border: "1px dashed var(--border-hover)",
            display: "grid",
            placeItems: "center",
            fontSize: "1.35rem",
          }}
        >
          +
        </div>
        <span style={{ fontWeight: 600 }}>{label}</span>
      </div>
    </Link>
  );
}
