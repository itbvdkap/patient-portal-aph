import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canAdminAccessPath, resolveAdminSession as getAdminSession } from "@/lib/admin/session";

export const dynamic = "force-dynamic";
export default async function KskLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session, "/admin/ksk")) redirect("/admin");
  return children;
}
