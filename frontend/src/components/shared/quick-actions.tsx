import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, UserPlus, CalendarPlus, FileText, Pill, FlaskConical, Stethoscope, X } from "lucide-react";

const actions = [
  { id: "new-patient", label: "Новый пациент", icon: UserPlus, color: "#2563eb", to: "/patients/new" },
  { id: "new-appointment", label: "Новый приём", icon: CalendarPlus, color: "#7c3aed", to: "/schedule" },
  { id: "new-referral", label: "Направление", icon: FileText, color: "#0891b2", to: "/referrals" },
  { id: "new-prescription", label: "Рецепт", icon: Pill, color: "#f59e0b", to: "/document-templates" },
  { id: "new-lab", label: "Анализы", icon: FlaskConical, color: "#10b981", to: "/laboratory" },
  { id: "new-visit", label: "AI Суммаризация", icon: Stethoscope, color: "#ec4899", to: "/visit-summaries" },
];

export function QuickActions() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      {/* Floating action button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-secondary-deep)] text-white shadow-xl shadow-[var(--color-secondary)]/25 flex items-center justify-center hover:shadow-2xl hover:shadow-[var(--color-secondary)]/30 transition-all active:scale-95"
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>
          {open ? <X size={22} /> : <Zap size={22} />}
        </motion.div>
      </button>

      {/* Actions panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 right-6 z-50 w-56 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Быстрые действия</p>
            </div>
            <div className="py-1">
              {actions.map((action, i) => (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => { navigate({ to: action.to as any }); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-muted)] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${action.color}12` }}>
                    <action.icon size={16} style={{ color: action.color }} />
                  </div>
                  <span className="text-sm text-[var(--color-text-primary)]">{action.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
