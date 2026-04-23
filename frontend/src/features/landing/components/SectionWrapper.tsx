import { motion } from "framer-motion";
import { useScrollAnimation } from "../hooks/useScrollAnimation";

interface SectionWrapperProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionWrapper({ id, children, className = "" }: SectionWrapperProps) {
  const { ref, isInView, prefersReducedMotion } = useScrollAnimation();

  return (
    <section id={id} ref={ref} className={`relative px-4 py-20 md:py-28 ${className}`}>
      <motion.div
        className="mx-auto max-w-6xl"
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </section>
  );
}
