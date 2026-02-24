import type { ComponentMeta, ContentBlock } from "@/lib/types";

export const componentsRegistry: ComponentMeta[] = [
  {
    id: "home-hero",
    name: "HomeHero",
    path: "src/app/(public)/page.tsx",
    description: "Bandeau principal de la page d’accueil avec argumentaire.",
    category: "section",
    contentKeys: ["home.hero.title", "home.hero.subtitle", "home.hero.cta"],
  },
  {
    id: "center-card",
    name: "CenterCard",
    path: "src/components/centers/CenterCard.tsx",
    description: "Carte listant un centre de stockage avec prix et surface.",
    category: "card",
    contentKeys: ["center.card.title", "center.card.badge.marketplace"],
  },
  {
    id: "booking-tunnel-header",
    name: "BookingTunnelHeader",
    path: "src/components/booking/TunnelHeader.tsx",
    description: "En-tête du tunnel de réservation avec étapes.",
    category: "layout",
    contentKeys: ["booking.tunnel.title", "booking.tunnel.step.summary"],
  },
  {
    id: "home-features-grid",
    name: "HomeFeaturesGrid",
    path: "src/components/home/FeaturesGrid.tsx",
    description: "Bloc des avantages principaux sur la home.",
    category: "section",
    contentKeys: ["home.features.title", "home.features.item1", "home.features.item2"],
  },
  {
    id: "center-search-form",
    name: "CenterSearchForm",
    path: "src/components/search/CenterSearchForm.tsx",
    description: "Formulaire de recherche de centres par ville et taille.",
    category: "form",
    contentKeys: ["search.form.city", "search.form.size", "search.form.submit"],
  },
  {
    id: "pricing-comparison-card",
    name: "PricingComparisonCard",
    path: "src/components/pricing/ComparisonCard.tsx",
    description: "Comparateur marketplace vs Kostok sur une carte.",
    category: "card",
    contentKeys: ["pricing.card.marketplace", "pricing.card.kostok", "pricing.card.savings"],
  },
  {
    id: "cta-primary",
    name: "PrimaryCTAButton",
    path: "src/components/ui/PrimaryButton.tsx",
    description: "Bouton CTA principal global.",
    category: "button",
    contentKeys: ["cta.primary.start", "cta.primary.contact"],
  },
  {
    id: "footer-links",
    name: "FooterLinks",
    path: "src/components/layout/FooterLinks.tsx",
    description: "Liens footer légaux et navigation secondaire.",
    category: "layout",
    contentKeys: ["footer.legal", "footer.privacy", "footer.contact"],
  },
  {
    id: "login-page-header",
    name: "LoginPageHeader",
    path: "src/app/login/page.tsx",
    description: "Titre et sous-titre de la page login admin.",
    category: "page",
    contentKeys: ["login.title", "login.subtitle"],
  },
  {
    id: "client-card",
    name: "ClientCard",
    path: "src/components/clients/ClientCard.tsx",
    description: "Carte synthèse client pour listing rapide.",
    category: "card",
    contentKeys: ["client.card.title", "client.card.segment", "client.card.status"],
  },
];

export const contentBlocks: ContentBlock[] = [
  {
    id: "cb-home-hero-title-fr",
    componentId: "home-hero",
    key: "home.hero.title",
    language: "fr",
    value: "Le stockage flexible partout en France",
    description: "Titre principal de la home en français.",
    lastUpdatedBy: "Admin",
    lastUpdatedAt: "2024-02-01T09:00:00Z",
  },
  {
    id: "cb-home-hero-subtitle-fr",
    componentId: "home-hero",
    key: "home.hero.subtitle",
    language: "fr",
    value: "Comparez les centres de stockage pros et particuliers en quelques clics.",
    description: "Sous-titre de la home en français.",
    lastUpdatedBy: "Content",
    lastUpdatedAt: "2024-02-05T11:10:00Z",
  },
  {
    id: "cb-center-card-badge-marketplace-fr",
    componentId: "center-card",
    key: "center.card.badge.marketplace",
    language: "fr",
    value: "Marketplace",
    description: "Badge indiquant qu’un centre est opéré via la marketplace.",
    lastUpdatedBy: "Content",
    lastUpdatedAt: "2024-01-20T10:00:00Z",
  },
  {
    id: "cb-home-hero-title-en",
    componentId: "home-hero",
    key: "home.hero.title",
    language: "en",
    value: "Flexible storage across France",
    description: "Main home title in English.",
    lastUpdatedBy: "Content",
    lastUpdatedAt: "2024-02-06T09:00:00Z",
  },
  {
    id: "cb-home-features-title-fr",
    componentId: "home-features-grid",
    key: "home.features.title",
    language: "fr",
    value: "Pourquoi choisir Costockage ?",
    description: "Titre section avantages FR.",
    lastUpdatedBy: "Admin",
    lastUpdatedAt: "2024-02-04T12:00:00Z",
  },
  {
    id: "cb-home-features-item1-fr",
    componentId: "home-features-grid",
    key: "home.features.item1",
    language: "fr",
    value: "Réservation rapide en 3 étapes",
    description: "Avantage 1 FR.",
    lastUpdatedBy: "Content",
    lastUpdatedAt: "2024-02-04T12:05:00Z",
  },
  {
    id: "cb-home-features-item2-fr",
    componentId: "home-features-grid",
    key: "home.features.item2",
    language: "fr",
    value: "Réseau national de centres partenaires",
    description: "Avantage 2 FR.",
    lastUpdatedBy: "Content",
    lastUpdatedAt: "2024-02-04T12:10:00Z",
  },
  {
    id: "cb-search-city-fr",
    componentId: "center-search-form",
    key: "search.form.city",
    language: "fr",
    value: "Ville",
    description: "Label ville formulaire recherche.",
    lastUpdatedBy: "Admin",
    lastUpdatedAt: "2024-02-03T08:35:00Z",
  },
  {
    id: "cb-search-size-fr",
    componentId: "center-search-form",
    key: "search.form.size",
    language: "fr",
    value: "Taille souhaitée",
    description: "Label taille formulaire recherche.",
    lastUpdatedBy: "Admin",
    lastUpdatedAt: "2024-02-03T08:36:00Z",
  },
  {
    id: "cb-search-submit-fr",
    componentId: "center-search-form",
    key: "search.form.submit",
    language: "fr",
    value: "Comparer les centres",
    description: "Texte bouton recherche.",
    lastUpdatedBy: "Content",
    lastUpdatedAt: "2024-02-03T08:37:00Z",
  },
  {
    id: "cb-pricing-marketplace-fr",
    componentId: "pricing-comparison-card",
    key: "pricing.card.marketplace",
    language: "fr",
    value: "Offre marketplace",
    description: "Label offre marketplace.",
    lastUpdatedBy: "Content",
    lastUpdatedAt: "2024-02-02T14:00:00Z",
  },
  {
    id: "cb-pricing-kostok-fr",
    componentId: "pricing-comparison-card",
    key: "pricing.card.kostok",
    language: "fr",
    value: "Offre Kostok",
    description: "Label offre Kostok.",
    lastUpdatedBy: "Content",
    lastUpdatedAt: "2024-02-02T14:02:00Z",
  },
  {
    id: "cb-pricing-savings-fr",
    componentId: "pricing-comparison-card",
    key: "pricing.card.savings",
    language: "fr",
    value: "Économisez jusqu'à 12%",
    description: "Accroche économies.",
    lastUpdatedBy: "Admin",
    lastUpdatedAt: "2024-02-02T14:03:00Z",
  },
  {
    id: "cb-cta-start-fr",
    componentId: "cta-primary",
    key: "cta.primary.start",
    language: "fr",
    value: "Commencer",
    description: "CTA démarrer FR.",
    lastUpdatedBy: "Content",
    lastUpdatedAt: "2024-01-29T10:20:00Z",
  },
  {
    id: "cb-cta-contact-fr",
    componentId: "cta-primary",
    key: "cta.primary.contact",
    language: "fr",
    value: "Parler à un conseiller",
    description: "CTA contact FR.",
    lastUpdatedBy: "Content",
    lastUpdatedAt: "2024-01-29T10:22:00Z",
  },
  {
    id: "cb-footer-legal-fr",
    componentId: "footer-links",
    key: "footer.legal",
    language: "fr",
    value: "Mentions légales",
    description: "Lien footer légal FR.",
    lastUpdatedBy: "Admin",
    lastUpdatedAt: "2024-01-30T09:12:00Z",
  },
  {
    id: "cb-footer-privacy-fr",
    componentId: "footer-links",
    key: "footer.privacy",
    language: "fr",
    value: "Politique de confidentialité",
    description: "Lien footer privacy FR.",
    lastUpdatedBy: "Admin",
    lastUpdatedAt: "2024-01-30T09:13:00Z",
  },
  {
    id: "cb-login-title-fr",
    componentId: "login-page-header",
    key: "login.title",
    language: "fr",
    value: "Connexion à l'admin",
    description: "Titre page login FR.",
    lastUpdatedBy: "Content",
    lastUpdatedAt: "2024-02-01T16:44:00Z",
  },
  {
    id: "cb-client-card-title-fr",
    componentId: "client-card",
    key: "client.card.title",
    language: "fr",
    value: "Fiche client",
    description: "Titre carte client FR.",
    lastUpdatedBy: "Admin",
    lastUpdatedAt: "2024-02-07T11:05:00Z",
  },
];

export function getComponentsRegistry(): ComponentMeta[] {
  return componentsRegistry;
}

export function getContentBlocks(): ContentBlock[] {
  return contentBlocks;
}

export function getContentBlocksByComponent(
  componentId: string
): ContentBlock[] {
  return contentBlocks.filter((b) => b.componentId === componentId);
}

export function updateContentBlock(
  id: string,
  value: string,
  actor: string
): ContentBlock | undefined {
  const block = contentBlocks.find((b) => b.id === id);
  if (!block) return undefined;
  block.value = value;
  block.lastUpdatedBy = actor;
  block.lastUpdatedAt = new Date().toISOString();
  return block;
}

