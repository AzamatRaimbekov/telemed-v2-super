import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { SectionWrapper } from "./SectionWrapper";
import { painSolutions } from "../data/modules";

export function LandingPainSolution() {
  return (
    <SectionWrapper id="pain-solution" className="bg-[#f8f9fb]">
      <h2 className="text-3xl md:text-4xl font-black text-center text-[#1a1a2e] mb-4">Знакомые проблемы?</h2>
      <p className="text-center text-[#6b7280] mb-14 max-w-xl mx-auto">Мы решаем их каждый день</p>
      <div className="grid md:grid-cols-2 gap-5">
        {painSolutions.map((item, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
            className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center"><X size={14} className="text-red-400" /></div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Проблема</span>
                </div>
                <p className="text-sm text-[#6b7280] leading-relaxed">{item.pain}</p>
              </div>
              <div className="p-6 bg-blue-50/30">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center"><Check size={14} className="text-[#2563eb]" /></div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#2563eb]">Решение</span>
                </div>
                <p className="text-sm text-[#1a1a2e] leading-relaxed font-medium">{item.solution}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </SectionWrapper>
  );
}
