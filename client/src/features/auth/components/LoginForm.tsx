import type { Dispatch, FormEvent, SetStateAction } from "react";

interface LoginFormProps {
  email: string;
  setEmail: Dispatch<SetStateAction<string>>;
  password: string;
  setPassword: Dispatch<SetStateAction<string>>;
  error: string;
  loading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onSwitchDemoRole: () => void;
}

export function LoginForm({ email, setEmail, password, setPassword, error, loading, onSubmit, onSwitchDemoRole }: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-sm rounded-lg border border-line bg-white/95 p-6 shadow-soft">
      <h2 className="text-2xl font-bold">Sign in</h2>
      <p className="mt-1 text-sm text-neutral-500">Use the seeded demo accounts to test both roles.</p>
      {error ? <div className="mt-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
      <label className="mt-5 block text-sm font-semibold">
        Email
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded border border-line px-3 py-2 outline-none focus:border-forest"
          type="email"
          autoComplete="email"
        />
      </label>
      <label className="mt-4 block text-sm font-semibold">
        Password
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded border border-line px-3 py-2 outline-none focus:border-forest"
          type="password"
          autoComplete="current-password"
        />
      </label>
      <button
        disabled={loading}
        className="mt-6 w-full rounded bg-forest px-4 py-2.5 font-semibold text-white shadow-[0_14px_30px_rgba(15,95,79,0.24)] hover:bg-forest/90 disabled:opacity-60"
        type="submit"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
      <button
        type="button"
        onClick={onSwitchDemoRole}
        className="mt-3 w-full rounded border border-line bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
      >
        Switch demo role
      </button>
    </form>
  );
}
