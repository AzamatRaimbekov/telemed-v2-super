import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

export function useHotkeys() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only when no input/textarea is focused
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      if (!e.altKey) return;

      const shortcuts: Record<string, string> = {
        d: "/dashboard",
        p: "/patients",
        s: "/schedule",
        t: "/tasks",
        c: "/chat",
        r: "/reports",
        q: "/queue",
      };

      if (shortcuts[e.key]) {
        e.preventDefault();
        navigate({ to: shortcuts[e.key] as any });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
}
