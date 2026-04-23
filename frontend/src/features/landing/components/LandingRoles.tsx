import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { SectionWrapper } from "./SectionWrapper";
import { roles } from "../data/modules";

export function LandingRoles() {
  const [activeRole, setActiveRole] = useState(roles[0].id);
  const current = roles.find((r) => r.id === activeRole)!;
  return (
    <SectionWrapper className="bg-[#f8f9fb]">
      <h2 className="text-3xl md:text-4xl font-black text-center text-[#1a1a2e] mb-4">Каждому — своё рабочее место</h2>
      <p className="text-center text-[#6b7280] mb-14 max-w-xl mx-auto">Один вход, разные возможности</p>
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {roles.map((role) => { const isActive = role.id === activeRole; return (
          <button key={role.id} onClick={() => setActiveRole(role.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-white border border-gray-200 text-[#1a1a2e] shadow-sm" : "text-[#9ca3af] hover:text-[#6b7280]"}`}>
            <role.icon size={16} style={isActive ? { color: role.color } : undefined} />
            <span className="hidden sm:inline">{role.label}</span>
          </button>
        );})}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={current.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="max-w-lg mx-auto">
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${current.color}12` }}>
                <current.icon size={20} style={{ color: current.color }} />
              </div>
              <h3 className="text-lg font-bold text-[#1a1a2e]">{current.label}</h3>
            </div>
            <ul className="space-y-3">{current.features.map((f, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${current.color}12` }}>
                  <Check size={12} style={{ color: current.color }} />
                </div>
                <span className="text-sm text-[#6b7280] leading-relaxed">{f}</span>
              </li>
            ))}</ul>
          </div>
        </motion.div>
      </AnimatePresence>
    </SectionWrapper>
  );
}
