// Mock authentication system with 2FA (TOTP)

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  role: "admin" | "operator";
  totpSecret?: string;
  totpEnabled: boolean;
  profileImage?: string; // data URL or image path for mock
}

let currentUser: User | null = null;

const STORAGE_KEY = "admin-current-user";

function persistCurrentUser(user: User | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function normalizeUserRole(role: string | undefined): User["role"] {
  return role === "admin" ? "admin" : "operator";
}

function hydrateCurrentUserFromStorage() {
  if (typeof window === "undefined") return;
  if (currentUser) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as User & { role?: string };
    if (parsed?.id) {
      currentUser = {
        ...parsed,
        role: normalizeUserRole(parsed.role),
      };
    }
  } catch {
    // ignore malformed storage
  }
}

export function syncCurrentUserFromStorage(): User | null {
  hydrateCurrentUserFromStorage();
  return currentUser;
}

const mockUsers: User[] = [
  {
    id: "u_admin",
    email: "admin@costockage.fr",
    firstName: "Admin",
    lastName: "Costockage",
    fullName: "Admin Costockage",
    role: "admin",
    totpSecret: "JBSWY3DPEHPK3PXP",
    totpEnabled: true,
    profileImage: undefined,
  },
  {
    id: "u_admin_theo",
    email: "theo.admin@costockage.fr",
    firstName: "Theo",
    lastName: "Admin",
    fullName: "Theo Admin",
    role: "admin",
    totpSecret: "JBSWY3DPEHPK3PXP",
    totpEnabled: true,
    profileImage: undefined,
  },
  {
    id: "u1",
    email: "paul.sales@costockage.fr",
    firstName: "Paul",
    lastName: "Martin",
    fullName: "Paul Martin",
    role: "operator",
    totpSecret: "JBSWY3DPEHPK3PXP",
    totpEnabled: true,
    profileImage: undefined,
  },
  {
    id: "u2",
    email: "camille.support@costockage.fr",
    firstName: "Camille",
    lastName: "Dubois",
    fullName: "Camille Dubois",
    role: "operator",
    totpSecret: "MFRGG43FMZQXIZLT",
    totpEnabled: true,
    profileImage: undefined,
  },
];

export function getCurrentUser(): User | null {
  return currentUser;
}

export function syncCurrentUser(user: User | null): User | null {
  const normalizedUser = user
    ? {
        ...user,
        role: normalizeUserRole(user.role),
      }
    : null;
  currentUser = normalizedUser;

  if (normalizedUser) {
    const idx = mockUsers.findIndex((u) => u.id === normalizedUser.id);
    if (idx !== -1) {
      mockUsers[idx] = normalizedUser;
    } else {
      mockUsers.push(normalizedUser);
    }
  }

  persistCurrentUser(currentUser);
  return currentUser;
}

export async function updateCurrentUser(update: Partial<User>): Promise<User | null> {
  if (!currentUser) return null;

  // Try to persist to server API if available
  try {
    if (typeof window !== "undefined") {
      const payload = { ...currentUser, ...update };
      const res = await fetch(`/api/accounts/${currentUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        const nextFirstName = data.firstName ?? currentUser.firstName ?? "";
        const nextLastName = data.lastName ?? currentUser.lastName ?? "";
        const nextFullName = `${nextFirstName} ${nextLastName}`.trim() || data.fullName || currentUser.fullName;
        // map server row to User shape
        const user: User = {
          id: data.id ?? currentUser.id,
          email: data.email ?? currentUser.email,
          firstName: nextFirstName || undefined,
          lastName: nextLastName || undefined,
          fullName: nextFullName,
          role:
            data.role === "admin"
              ? "admin"
              : data.role === "operator"
              ? "operator"
              : "operator",
          totpSecret: data.totpSecret ?? currentUser.totpSecret,
          totpEnabled: !!(data.totpEnabled ?? currentUser.totpEnabled),
          profileImage: data.profileImage ?? currentUser.profileImage ?? undefined,
        };
        return syncCurrentUser(user);
      }
    }
  } catch (err) {
    // ignore and fallback to local update
    console.warn("updateCurrentUser: server update failed", err);
  }

  // Fallback to in-memory update
  const idx = mockUsers.findIndex((u) => u.id === currentUser!.id);
  if (idx !== -1) {
    mockUsers[idx] = { ...mockUsers[idx], ...update };
    return syncCurrentUser({ ...mockUsers[idx] });
  }
  return null;
}

export function login(email: string, password: string): User | null {
  const user = mockUsers.find((u) => u.email === email);
  if (!user || password !== "demo123") return null;
  return syncCurrentUser(user);
}

export function logout() {
  syncCurrentUser(null);
}

export function generateTOTP(secret: string): string {
  // Mock TOTP generation - en production utiliser une vraie librairie comme 'otplib'
  const now = Math.floor(Date.now() / 10000);
  const code = (now % 1000000).toString().padStart(6, "0");
  return code;
}

export function verifyTOTP(secret: string, code: string): boolean {
  const expected = generateTOTP(secret);
  return code === expected || code === "123456"; // Code de secours pour les tests
}

export function enable2FA(userId: string, secret: string) {
  const user = mockUsers.find((u) => u.id === userId);
  if (user) {
    user.totpSecret = secret;
    user.totpEnabled = true;
  }
}
