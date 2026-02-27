import type { AccountRow } from "./account-store";

export const initialAccounts: Partial<AccountRow>[] = [
  {
    id: "u_admin_theo",
    email: "theo@costockage.fr",
    fullName: "Théo Mingault",
    role: "admin",
    profileImage: null,
    totpEnabled: 0,
  },
];
