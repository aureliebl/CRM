export interface AssistantConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  chatflowid: string;
}

export const ASSISTANTS: AssistantConfig[] = [
  {
    id: "general",
    name: "Assistant Général",
    description: "Assistant polyvalent pour répondre à toutes vos questions.",
    icon: "smart_toy",
    chatflowid: "47146e72-8790-4600-846f-03ba7e0301ae",
  },
  {
    id: "commercial",
    name: "Assistant Commercial",
    description: "Aide à la rédaction de devis et suivi client.",
    icon: "storefront",
    chatflowid: "47146e72-8790-4600-846f-03ba7e0301ae",
  },
  {
    id: "technique",
    name: "Assistant Technique",
    description: "Support technique et résolution de problèmes.",
    icon: "build",
    chatflowid: "47146e72-8790-4600-846f-03ba7e0301ae",
  },
  {
    id: "rh",
    name: "Assistant RH",
    description: "Gestion des ressources humaines et questions internes.",
    icon: "groups",
    chatflowid: "47146e72-8790-4600-846f-03ba7e0301ae",
  },
];

export const ASSISTANTS_BY_ID: Record<string, AssistantConfig> = Object.fromEntries(
  ASSISTANTS.map((a) => [a.id, a]),
);
