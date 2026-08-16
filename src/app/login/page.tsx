import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { DemoBanner } from "@/components/demo-banner";
import { InstallAppButton } from "@/components/install-app-button";
import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen">
      <DemoBanner />
      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-md flex-col justify-center px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <BrandLogo size={56} />
          <div>
            <p className="text-sm font-semibold uppercase text-primary-700">Cổng thông tin bệnh nhân</p>
            <h1 className="font-serif text-xl font-bold text-ink">Bệnh viện Đa khoa An Phú</h1>
          </div>
        </div>
        <section className="rounded-md border border-cream-200 bg-cream-50 p-5 shadow-soft">
          <h2 className="font-serif text-2xl font-bold text-ink">Đăng nhập</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Xác minh hồ sơ bằng số điện thoại và CCCD/CMND đã đăng ký tại bệnh viện.
          </p>
          <div className="mt-5">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </section>
        <InstallAppButton className="mt-4 w-full" />
      </div>
    </main>
  );
}
