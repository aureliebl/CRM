"use client";

import Lottie from "lottie-react";
import rippleAnimation from "@/assets/lottie/tab-loading-ripple.json";

export function TabLoadingIndicator({
  label = "Chargement...",
}: {
  label?: string;
}) {
  return (
    <section
      className="admin-placeholder-card"
      style={{
        minHeight: "180px",
        display: "grid",
        placeItems: "center",
        gap: "0.35rem",
      }}
    >
      <div style={{ width: 76, height: 76 }}>
        <Lottie animationData={rippleAnimation} loop autoplay />
      </div>
      <p
        style={{
          margin: 0,
          fontSize: "0.84rem",
          color: "var(--text-secondary)",
          fontWeight: 500,
        }}
      >
        {label}
      </p>
    </section>
  );
}