import type { FormEvent } from "react";
import type { SalesUserForm } from "../../../types";

interface CreateSalesUserFormProps {
  newSalesUser: SalesUserForm;
  updateNewSalesUser: (field: keyof SalesUserForm, value: string) => void;
  createSalesUser: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function CreateSalesUserForm({ newSalesUser, updateNewSalesUser, createSalesUser }: CreateSalesUserFormProps) {
  return (
    <section className="mt-6 rounded-lg border border-line bg-white p-5 shadow-soft">
      <h2 className="text-lg font-bold">Create Sales User</h2>
      <form onSubmit={createSalesUser} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <input value={newSalesUser.name} onChange={(event) => updateNewSalesUser("name", event.target.value)} required placeholder="Name" className="rounded border border-line px-3 py-2" />
        <input value={newSalesUser.email} onChange={(event) => updateNewSalesUser("email", event.target.value)} required type="email" placeholder="Email" className="rounded border border-line px-3 py-2" />
        <input value={newSalesUser.password} onChange={(event) => updateNewSalesUser("password", event.target.value)} required type="password" minLength={8} placeholder="Temporary password" className="rounded border border-line px-3 py-2" />
        <button className="rounded bg-ink px-4 py-2 font-semibold text-white">Create</button>
      </form>
    </section>
  );
}
