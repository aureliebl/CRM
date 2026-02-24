"use client";

import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import {
  getGeoAiAgentAggregates,
  getGeoAiEvents,
  getGeoQualitySummary,
} from "@/lib/mock/geo";
import { useLocale } from "@/lib/use-locale";

export default function GeoPage() {
  const { locale } = useLocale();
  const formatLocale = locale === "fr" ? "fr-FR" : "en-US";
  const fr = locale === "fr";

  const summary = getGeoQualitySummary();
  const agentRows = getGeoAiAgentAggregates().map((row) => ({
    ...row,
    avgQualityScoreLabel: `${row.avgQualityScore}/100`,
    citationsRateLabel: `${row.citationsRate}%`,
  }));

  const eventRows = getGeoAiEvents().map((event) => ({
    ...event,
    detectedAtLabel: new Date(event.detectedAt).toLocaleString(formatLocale, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    qualityScoreLabel: event.sourceType === "crawler" ? "—" : `${event.qualityScore}/100`,
    intentLabel:
      event.intent === "transaction"
        ? fr
          ? "Transactionnelle"
          : "Transactional"
        : event.intent === "comparison"
        ? fr
          ? "Comparaison"
          : "Comparison"
        : fr
        ? "Informationnelle"
        : "Informational",
    answerPresenceLabel:
      event.answerPresence === "citation"
        ? fr
          ? "Citation"
          : "Citation"
        : event.answerPresence === "mention"
        ? fr
          ? "Mention"
          : "Mention"
        : fr
        ? "Aucune"
        : "None",
    sourceTypeLabel:
      event.sourceType === "crawler"
        ? "Crawler"
        : event.sourceType === "assistant-browser"
        ? fr
          ? "Navigateur IA"
          : "AI browser"
        : fr
        ? "Référent chat IA"
        : "AI chat referral",
  }));

  const labels = fr
    ? {
        title: "GEO — Visibilité IA",
        subtitle:
          "Suivi des IA passées sur le front, des modèles détectés et de la qualité des recherches IA qui nous citent.",
        kpiVisits: "Passages IA",
        kpiAgents: "IA distinctes",
        kpiQuality: "Qualité moyenne",
        kpiIntent: "Part requêtes transactionnelles",
        kpiCitations: "Couverture citations",
        agentsTableTitle: "IA détectées (exactement)",
        eventsTableTitle: "Requêtes IA détectées",
        provider: "Provider",
        aiAgent: "IA",
        models: "Modèles",
        visits: "Passages",
        avgQuality: "Qualité moyenne",
        citationsRate: "% citations",
        clickPotential: "Potentiel clics",
        detectedAt: "Détecté le",
        sourceType: "Source",
        landingPage: "Page d'entrée",
        query: "Requête IA",
        quality: "Qualité",
        intent: "Intention",
        answerPresence: "Réponse IA",
        userAgent: "User-Agent",
      }
    : {
        title: "GEO — AI Visibility",
        subtitle:
          "Tracking AI agents seen on frontend traffic, exact models, and AI search quality for prompts that surface us.",
        kpiVisits: "AI visits",
        kpiAgents: "Distinct AIs",
        kpiQuality: "Average quality",
        kpiIntent: "Transactional query share",
        kpiCitations: "Citation coverage",
        agentsTableTitle: "Detected AI agents (exact)",
        eventsTableTitle: "Detected AI queries",
        provider: "Provider",
        aiAgent: "AI agent",
        models: "Models",
        visits: "Visits",
        avgQuality: "Average quality",
        citationsRate: "Citation %",
        clickPotential: "Click potential",
        detectedAt: "Detected at",
        sourceType: "Source",
        landingPage: "Landing page",
        query: "AI query",
        quality: "Quality",
        intent: "Intent",
        answerPresence: "AI answer",
        userAgent: "User-Agent",
      };

  return (
    <div>
      <h1 className="admin-page-title">{labels.title}</h1>
      <p className="admin-page-description">{labels.subtitle}</p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "0.9rem",
          marginBottom: "1rem",
        }}
      >
        <article className="admin-placeholder-card" style={{ padding: "0.9rem" }}>
          <div className="admin-placeholder-title">{labels.kpiVisits}</div>
          <strong style={{ fontSize: "1.3rem" }}>{summary.visits}</strong>
        </article>
        <article className="admin-placeholder-card" style={{ padding: "0.9rem" }}>
          <div className="admin-placeholder-title">{labels.kpiAgents}</div>
          <strong style={{ fontSize: "1.3rem" }}>{summary.distinctAgents}</strong>
        </article>
        <article className="admin-placeholder-card" style={{ padding: "0.9rem" }}>
          <div className="admin-placeholder-title">{labels.kpiQuality}</div>
          <strong style={{ fontSize: "1.3rem" }}>{summary.avgQualityScore}/100</strong>
        </article>
        <article className="admin-placeholder-card" style={{ padding: "0.9rem" }}>
          <div className="admin-placeholder-title">{labels.kpiIntent}</div>
          <strong style={{ fontSize: "1.3rem" }}>{summary.highIntentShare}%</strong>
        </article>
        <article className="admin-placeholder-card" style={{ padding: "0.9rem" }}>
          <div className="admin-placeholder-title">{labels.kpiCitations}</div>
          <strong style={{ fontSize: "1.3rem" }}>{summary.citationCoverage}%</strong>
        </article>
      </section>

      <div style={{ marginBottom: "1rem" }}>
        <TableWithColumnFilters
          title={labels.agentsTableTitle}
          description={
            fr
              ? "Quelles IA exactes ont touché le front, avec leurs modèles, volume et qualité moyenne."
              : "Exact AI agents seen on frontend traffic, with models, volume, and quality score."
          }
          data={agentRows}
          columns={[
            { key: "provider", label: labels.provider, filterType: "text" },
            { key: "aiAgent", label: labels.aiAgent, filterType: "text" },
            { key: "models", label: labels.models, filterType: "text" },
            { key: "visits", label: labels.visits, filterType: "number" },
            {
              key: "avgQualityScoreLabel",
              label: labels.avgQuality,
              filterType: "text",
            },
            {
              key: "citationsRateLabel",
              label: labels.citationsRate,
              filterType: "text",
            },
            {
              key: "clickPotential",
              label: labels.clickPotential,
              filterType: "number",
            },
          ]}
          defaultPageSize={10}
          pageSizeOptions={[10, 25, 50]}
        />
      </div>

      <TableWithColumnFilters
        title={labels.eventsTableTitle}
        description={
          fr
            ? "Détail des visites IA: requête, intention et score de qualité de recherche IA."
            : "Detailed AI visits: query, intent and AI search quality score."
        }
        data={eventRows}
        columns={[
          { key: "detectedAtLabel", label: labels.detectedAt, filterType: "text" },
          { key: "provider", label: labels.provider, filterType: "text" },
          { key: "aiAgent", label: labels.aiAgent, filterType: "text" },
          { key: "model", label: labels.models, filterType: "text" },
          { key: "sourceTypeLabel", label: labels.sourceType, filterType: "select", selectOptions: [
            { value: "Crawler", label: "Crawler" },
            { value: fr ? "Navigateur IA" : "AI browser", label: fr ? "Navigateur IA" : "AI browser" },
            { value: fr ? "Référent chat IA" : "AI chat referral", label: fr ? "Référent chat IA" : "AI chat referral" },
          ] },
          { key: "landingPage", label: labels.landingPage, filterType: "text" },
          { key: "query", label: labels.query, filterType: "text" },
          { key: "qualityScoreLabel", label: labels.quality, filterType: "text" },
          { key: "intentLabel", label: labels.intent, filterType: "select", selectOptions: [
            { value: fr ? "Informationnelle" : "Informational", label: fr ? "Informationnelle" : "Informational" },
            { value: fr ? "Comparaison" : "Comparison", label: fr ? "Comparaison" : "Comparison" },
            { value: fr ? "Transactionnelle" : "Transactional", label: fr ? "Transactionnelle" : "Transactional" },
          ] },
          { key: "answerPresenceLabel", label: labels.answerPresence, filterType: "select", selectOptions: [
            { value: fr ? "Citation" : "Citation", label: fr ? "Citation" : "Citation" },
            { value: fr ? "Mention" : "Mention", label: fr ? "Mention" : "Mention" },
            { value: fr ? "Aucune" : "None", label: fr ? "Aucune" : "None" },
          ] },
          { key: "userAgent", label: labels.userAgent, filterType: "text" },
        ]}
        defaultPageSize={10}
        pageSizeOptions={[10, 25, 50]}
      />
    </div>
  );
}