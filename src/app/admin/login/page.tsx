import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/app/admin/login/admin-login-form";
import { getAdminSession, isAdminConfigured } from "@/lib/admin/session";

export default async function AdminLoginPage() {
  const session = getAdminSession(await cookies());
  if (session) redirect("/admin");

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,rgba(230,243,240,0.92),rgba(255,250,241,0.98)_320px),#fffaf1] px-4 py-10 text-ink">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-700">An Phú Care</p>
          <p className="mt-1 font-serif text-xl font-black text-ink">Portal Admin</p>
        </div>
        <AdminLoginForm configured={isAdminConfigured()} />
      </div>
    </main>
  );
}
