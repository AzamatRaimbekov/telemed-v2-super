import { motion, AnimatePresence } from "framer-motion";

interface HintChipsProps {
  hints: string[];
  visible: boolean;
  size: "sm" | "md" | "lg";
  onHintClick: (hint: string) => void;
}

const sizeClasses = {
  sm: "text-xs px-2 py-1",
  md: "text-sm px-3 py-1.5",
  lg: "text-base px-4 py-2",
};

export function HintChips({ hints, visible, size, onHintClick }: HintChipsProps) {
  return (
    <AnimatePresence>
      {visible && hints.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-20 right-6 z-50 flex flex-wrap gap-2 max-w-xs justify-end"
        >
          {hints.slice(0, 3).map((hint, i) => (
            <motion.button
              key={hint}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => onHintClick(hint)}
              className={`
                rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]
                text-[var(--color-text-secondary)] shadow-sm
                hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-foreground)]
                hover:border-[var(--color-primary-deep)] transition-colors
                ${sizeClasses[size]}
              `}
            >
              {hint}
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
