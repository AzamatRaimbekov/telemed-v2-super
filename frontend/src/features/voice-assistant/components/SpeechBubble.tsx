import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface SpeechBubbleProps {
  transcript: string;
  response: string | null;
  visible: boolean;
  onClose: () => void;
}

export function SpeechBubble({ transcript, response, visible, onClose }: SpeechBubbleProps) {
  return (
    <AnimatePresence>
      {visible && (transcript || response) && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-20 right-6 z-50 max-w-sm w-72"
        >
          <div className="rounded-2xl bg-[var(--color-surface)] shadow-xl border border-[var(--color-border)] p-4">
            <button
              onClick={onClose}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-[var(--color-muted)] text-[var(--color-text-tertiary)]"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>

            {transcript && (
              <div className="mb-2">
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Вы сказали:</p>
                <p className="text-sm text-[var(--color-text-primary)]">{transcript}</p>
              </div>
            )}

            {response && (
              <div className="pt-2 border-t border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Ассистент:</p>
                <p className="text-sm text-[var(--color-text-primary)]">{response}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
