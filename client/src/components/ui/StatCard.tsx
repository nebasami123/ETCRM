type Tone = "default" | "forest" | "coral" | "gold";

export function StatCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: Tone }) {
  const tones = {
    default: "border-line bg-white",
    forest: "border-forest/20 bg-forest text-white",
    coral: "border-coral/20 bg-coral text-white shadow-[0_20px_42px_rgba(227,95,79,0.18)]",
    gold: "border-gold/20 bg-gold text-white shadow-[0_20px_42px_rgba(201,148,40,0.2)]"
  };

  return (
    <div className={`rounded-lg border p-4 shadow-soft transition-transform duration-200 hover:-translate-y-0.5 ${tones[tone]}`}>
      <p className="text-sm opacity-75">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
