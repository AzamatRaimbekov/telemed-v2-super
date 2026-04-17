import { motion, AnimatePresence } from "framer-motion";
import type { VoiceAction } from "../types";

interface ConfirmationDialogProps {
  action: VoiceAction | null;
  onConfirm: (confirmed: boolean) => void;
}

export function ConfirmationDialog({ action, onConfirm }: ConfirmationDialogProps) {
  return (
    <AnimatePresence>
      {action && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[var(--color-surface)] rounded-2xl shadow-xl p-6 max-w-sm mx-4"
          >
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              Подтверждение
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              {action.description}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => onConfirm(false)}
                className="flex-1 px-4 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => onConfirm(true)}
                className="flex-1 px-4 py-2 rounded-xl bg-[var(--color-secondary)] text-white hover:bg-[var(--color-secondary-deep)] transition-colors"
              >
                Подтвердить
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
