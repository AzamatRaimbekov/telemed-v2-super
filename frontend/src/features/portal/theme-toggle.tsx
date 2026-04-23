import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem("portal_theme") === "dark");

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("portal_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("portal_theme", "light");
    }
  }, [dark]);

  return (
    <button
      onClick={() => setDark(!dark)}
      className="p-2 rounded-xl text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] transition-all"
      title={dark ? "Светлая тема" : "Тёмная тема"}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
