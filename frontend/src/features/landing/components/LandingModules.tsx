import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";
import { modules, groupColors, groupLabels, type Module } from "../data/modules";

function ModuleCard({ mod, index }: { mod: Module; index: number }) {
  const color = groupColors[mod.group];
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: index * 0.04 }} whileHover={{ y: -3 }}
      className="group rounded-2xl bg-white border border-gray-100 shadow-sm p-5 cursor-default transition-all hover:shadow-md hover:border-gray-200">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}10` }}>
        <mod.icon size={20} style={{ color }} />
      </div>
      <h3 className="text-sm font-bold text-[#1a1a2e] mb-1">{mod.name}</h3>
      <p className="text-xs text-[#9ca3af] leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-300">{mod.description}</p>
    </motion.div>
  );
}

export function LandingModules() {
  const groups = (["medicine","management","technology"] as const).map((g) => ({ key: g, label: groupLabels[g], modules: modules.filter((m) => m.group === g) }));
  return (
    <SectionWrapper id="modules" className="bg-[#f8f9fb]">
      <h2 className="text-3xl md:text-4xl font-black text-center text-[#1a1a2e] mb-4">16 модулей. Одна подписка.</h2>
      <p className="text-center text-[#6b7280] mb-14 max-w-xl mx-auto">Каждый работает отдельно и вместе</p>
      {groups.map((group) => (
        <div key={group.key} className="mb-10 last:mb-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full" style={{ background: groupColors[group.key] }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: groupColors[group.key] }}>{group.label}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {group.modules.map((mod, i) => <ModuleCard key={mod.name} mod={mod} index={i} />)}
          </div>
        </div>
      ))}
    </SectionWrapper>
  );
}
