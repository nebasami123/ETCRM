import { Navigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "../../features/auth/components/LoginForm";
import { useLogin } from "../../features/auth/hooks/useLogin";

export function LoginPage() {
  const login = useLogin();

  if (login.isAuthenticated && login.user) return <Navigate to={login.user.role === "ADMIN" ? "/admin" : "/sales"} replace />;

  return (
    <main className="grid min-h-screen bg-mist lg:grid-cols-[1fr_460px]">
      <section className="relative flex min-h-[42vh] overflow-hidden bg-forest p-8 text-white lg:min-h-screen lg:p-10">
        <div className="relative z-10 flex w-full flex-col justify-between">
          <div className="inline-flex w-fit items-center gap-2 rounded border border-white/15 bg-white/10 px-3 py-2 text-lg font-bold shadow-soft backdrop-blur">
            <ShieldCheck size={24} />
            ETCRM
          </div>
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-normal text-white/70">Customer Relationship Management</p>
            <h1 className="mt-3 text-4xl font-bold tracking-normal sm:text-5xl">Run the sales day from one focused workspace.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/80">
              Admins manage quotas, imports, and exports. Sales agents work through today&apos;s leads, notes, and follow-ups.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-white/80 sm:grid-cols-2">
            <div className="rounded border border-white/15 bg-white/10 p-4 shadow-soft backdrop-blur">Admin: admin@etcrm.local</div>
            <div className="rounded border border-white/15 bg-white/10 p-4 shadow-soft backdrop-blur">Sales: sales@etcrm.local</div>
          </div>
        </div>
        <div className="absolute right-0 top-16 h-px w-72 rotate-[-18deg] bg-white/15" />
        <div className="absolute bottom-20 left-1/4 h-px w-96 rotate-[-18deg] bg-white/10" />
      </section>
      <section className="flex items-center px-6 py-10 lg:px-8">
        <LoginForm
          email={login.email}
          setEmail={login.setEmail}
          password={login.password}
          setPassword={login.setPassword}
          error={login.error}
          loading={login.loading}
          onSubmit={login.handleSubmit}
          onSwitchDemoRole={login.switchDemoRole}
        />
      </section>
    </main>
  );
}
