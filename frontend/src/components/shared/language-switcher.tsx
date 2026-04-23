import { useTranslation } from "react-i18next";

const languages = [
  { code: "ru", label: "РУ", flag: "\u{1F1F7}\u{1F1FA}" },
  { code: "ky", label: "КЫ", flag: "\u{1F1F0}\u{1F1EC}" },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("ky") ? "ky" : "ru";

  return (
    <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
          className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
            current === lang.code
              ? "bg-[var(--color-secondary)] text-white"
              : "bg-[var(--color-surface)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
          }`}
        >
          {lang.flag} {lang.label}
        </button>
      ))}
    </div>
  );
}
