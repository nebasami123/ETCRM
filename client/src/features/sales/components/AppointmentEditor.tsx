import { Save } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

interface AppointmentEditorProps {
  appointmentDate: string;
  setAppointmentDate: Dispatch<SetStateAction<string>>;
  onSave: () => Promise<void>;
}

export function AppointmentEditor({ appointmentDate, setAppointmentDate, onSave }: AppointmentEditorProps) {
  return (
    <div>
      <label className="text-sm font-semibold">Appointment Date</label>
      <div className="mt-2 flex gap-2">
        <input
          type="datetime-local"
          value={appointmentDate}
          onChange={(event) => setAppointmentDate(event.target.value)}
          className="min-w-0 flex-1 rounded border border-line px-3 py-2"
        />
        <button type="button" onClick={onSave} className="inline-flex items-center gap-2 rounded bg-forest px-4 py-2 font-semibold text-white">
          <Save size={17} />
          Save
        </button>
      </div>
    </div>
  );
}
