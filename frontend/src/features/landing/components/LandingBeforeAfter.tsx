import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { FileSpreadsheet, FolderOpen, MessageCircle, BookOpen, Monitor, Search, BarChart3, Zap } from "lucide-react";
import { SectionWrapper } from "./SectionWrapper";
import { beforeItems, afterItems } from "../data/modules";
const beforeIcons = [FileSpreadsheet, FolderOpen, MessageCircle, BookOpen];
const afterIcons = [Monitor, Zap, Search, BarChart3];

export function LandingBeforeAfter() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start end", "end start"] });
  const beforeOpacity = useTransform(scrollYProgress, [0.2, 0.5], [1, 0.4]);
  const afterOpacity = useTransform(scrollYProgress, [0.2, 0.5], [0.4, 1]);
  return (
    <SectionWrapper>
      <h2 className="text-3xl md:text-4xl font-black text-center text-[#1a1a2e] mb-4">Цифровая трансформация</h2>
      <p className="text-center text-[#6b7280] mb-14 max-w-xl mx-auto">От хаоса к единой системе за один шаг</p>
      <div ref={containerRef} className="grid md:grid-cols-2 gap-6">
        <motion.div style={{ opacity: beforeOpacity }} className="rounded-2xl bg-gray-50 border border-gray-100 p-8">
          <span className="text-xs font-bold uppercase tracking-widest text-[#9ca3af] mb-6 block">Было</span>
          <div className="space-y-4">{beforeItems.map((item, i) => { const Icon = beforeIcons[i]; return (
            <div key={i} className="flex items-center gap-3 opacity-60"><div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"><Icon size={18} className="text-[#9ca3af]" /></div><span className="text-sm text-[#9ca3af]">{item}</span></div>
          );})}</div>
        </motion.div>
        <motion.div style={{ opacity: afterOpacity }} className="rounded-2xl bg-blue-50/50 border border-blue-100 p-8">
          <span className="text-xs font-bold uppercase tracking-widest text-[#2563eb] mb-6 block">Стало</span>
          <div className="space-y-4">{afterItems.map((item, i) => { const Icon = afterIcons[i]; return (
            <div key={i} className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-100/50 flex items-center justify-center"><Icon size={18} className="text-[#2563eb]" /></div><span className="text-sm text-[#1a1a2e] font-medium">{item}</span></div>
          );})}</div>
        </motion.div>
      </div>
    </SectionWrapper>
  );
}
