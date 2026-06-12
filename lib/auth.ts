import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import type { Session } from "next-auth";

export type AdminSession = Session & { user: { isAdmin: true } };

export async function getSession(): Promise<Session | null> {
  return getServerSession(authOptions);
}

export async function requireAdmin(): Promise<AdminSession | null> {
  const session = await getSession();
  if (!session?.user || !(session.user as { isAdmin?: boolean }).isAdmin) {
    return null;
  }
  return session as AdminSession;
}
