import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "var(--color-primary)", foreground: "var(--color-primary-foreground)" },
        secondary: { DEFAULT: "var(--color-secondary)", foreground: "var(--color-secondary-foreground)" },
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        foreground: "var(--color-text-primary)",
        muted: { DEFAULT: "var(--color-muted)", foreground: "var(--color-text-secondary)" },
        destructive: { DEFAULT: "var(--color-danger)", foreground: "#ffffff" },
        warning: { DEFAULT: "var(--color-warning)", foreground: "#ffffff" },
        success: { DEFAULT: "var(--color-success)", foreground: "#ffffff" },
        border: "var(--color-border)",
        input: "var(--color-input)",
        ring: "var(--color-ring)",
        card: { DEFAULT: "var(--color-surface)", foreground: "var(--color-text-primary)" },
        popover: { DEFAULT: "var(--color-surface)", foreground: "var(--color-text-primary)" },
        accent: { DEFAULT: "var(--color-accent)", foreground: "var(--color-accent-foreground)" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
