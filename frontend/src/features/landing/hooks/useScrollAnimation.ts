import { useRef } from "react";
import { useInView, useReducedMotion } from "framer-motion";

export function useScrollAnimation(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: threshold });
  const prefersReducedMotion = useReducedMotion();

  return { ref, isInView, prefersReducedMotion };
}
