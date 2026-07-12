import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../hooks/use-theme";

export function ThemeSwitch() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="btn-interactive inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground shadow-surface hover:bg-default hover:text-foreground/80 focus-visible:outline-none"
      title={`Switch to ${theme === "light" ? "Dark" : "Light"} mode`}
    >
      {theme === "light" ? (
        <Moon className="h-4.5 w-4.5 text-muted transition-transform hover:scale-110" />
      ) : (
        <Sun className="h-4.5 w-4.5 text-accent transition-transform hover:scale-110" />
      )}
    </button>
  );
}
