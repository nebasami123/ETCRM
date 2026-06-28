export const phaseLabels = {
  NEW: "New",
  CONTACTED: "Contacted",
  FOLLOW_UP: "Follow-Up",
  CLOSED_WON: "Closed-Won",
  CLOSED_LOST: "Closed-Lost"
};

export const phaseOptions = Object.entries(phaseLabels).map(([value, label]) => ({ value, label }));

export function todayInputValue() {
  const date = new Date();
  return date.toISOString().slice(0, 10);
}

export function formatDate(value) {
  if (!value) return "None";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
