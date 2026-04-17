import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2 } from "lucide-react";
import type { VoiceStatus } from "../types";
import { MIC_BUTTON_SIZE } from "../constants";

interface FloatingMicProps {
  status: VoiceStatus;
  onClick: () => void;
}

export function FloatingMic({ status, onClick }: FloatingMicProps) {
  const isListening = status === "listening";
  const isProcessing = status === "processing";
  const isError = status === "error";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
      <motion.button
        onClick={onClick}
        disabled={isProcessing}
        className={`
          relative flex items-center justify-center rounded-full shadow-lg
          transition-colors duration-200
          ${isListening ? "bg-[var(--color-danger)] text-white" : ""}
          ${isProcessing ? "bg-[var(--color-muted)] text-[var(--color-text-secondary)] cursor-wait" : ""}
          ${isError ? "bg-[var(--color-danger)]/20 text-[var(--color-danger)]" : ""}
          ${status === "idle" ? "bg-[var(--color-secondary)] text-white hover:bg-[var(--color-secondary-deep)]" : ""}
        `}
        style={{ width: MIC_BUTTON_SIZE, height: MIC_BUTTON_SIZE }}
        whileTap={{ scale: 0.9 }}
        aria-label={isListening ? "Остановить запись" : "Начать голосовую команду"}
      >
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Loader2 className="h-6 w-6 animate-spin" />
            </motion.div>
          ) : isListening ? (
            <motion.div key="mic-off" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <MicOff className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div key="mic" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Mic className="h-6 w-6" />
            </motion.div>
          )}
        </AnimatePresence>

        {isListening && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full bg-[var(--color-danger)]"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.span
              className="absolute inset-0 rounded-full bg-[var(--color-danger)]"
              animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            />
          </>
        )}
      </motion.button>
    </div>
  );
}
