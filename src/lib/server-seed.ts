import type { AccountRow } from "./account-store";

export const initialAccounts: Partial<AccountRow>[] = [
  {
    id: "u_admin",
    email: "admin@costockage.fr",
    fullName: "Admin Costockage",
    role: "admin",
    profileImage: null,
    totpEnabled: 1,
  },
  {
    id: "u_admin_theo",
    email: "theo.admin@costockage.fr",
    fullName: "Theo Admin",
    role: "admin",
    profileImage: null,
    totpEnabled: 1,
  },
  {
    id: "u1",
    email: "paul.sales@costockage.fr",
    fullName: "Paul Martin",
    role: "operator",
    profileImage: null,
    totpEnabled: 1,
  },
  {
    id: "u2",
    email: "camille.support@costockage.fr",
    fullName: "Camille Dubois",
    role: "operator",
    profileImage: null,
    totpEnabled: 1,
  },
];
