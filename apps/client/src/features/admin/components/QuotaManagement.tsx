import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { UserSummary } from "../../../types";

interface QuotaManagementProps {
  salesUsers: UserSummary[];
  selectedUser: string;
  setSelectedUser: Dispatch<SetStateAction<string>>;
  date: string;
  setDate: Dispatch<SetStateAction<string>>;
  callsTarget: number;
  setCallsTarget: Dispatch<SetStateAction<number>>;
  leadsTarget: number;
  setLeadsTarget: Dispatch<SetStateAction<number>>;
  saveQuota: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function QuotaManagement({
  salesUsers,
  selectedUser,
  setSelectedUser,
  date,
  setDate,
  callsTarget,
  setCallsTarget,
  leadsTarget,
  setLeadsTarget,
  saveQuota
}: QuotaManagementProps) {
  return (
    <section className="mt-6 rounded-lg border border-line bg-white p-5 shadow-soft">
      <h2 className="text-lg font-bold">Quota Management</h2>
      <form onSubmit={saveQuota} className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
        <select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)} className="rounded border border-line px-3 py-2">
          {salesUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        <input value={date} onChange={(event) => setDate(event.target.value)} type="date" className="rounded border border-line px-3 py-2" />
        <input value={callsTarget} onChange={(event) => setCallsTarget(Number(event.target.value))} type="number" min="0" className="rounded border border-line px-3 py-2" />
        <input value={leadsTarget} onChange={(event) => setLeadsTarget(Number(event.target.value))} type="number" min="0" className="rounded border border-line px-3 py-2" />
        <button className="rounded bg-ink px-4 py-2 font-semibold text-white">Save</button>
      </form>
    </section>
  );
}
