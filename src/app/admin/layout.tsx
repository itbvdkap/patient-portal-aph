import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { canAdminAccessPath, resolveAdminSession as getAdminSession } from "@/lib/admin/session";

export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-admin-path");
  if (pathname === "/admin/login") return children;
  const session = await getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (pathname && !canAdminAccessPath(session, pathname)) redirect("/admin");
  return children;
}
