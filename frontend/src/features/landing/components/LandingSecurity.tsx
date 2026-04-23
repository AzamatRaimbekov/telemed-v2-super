import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";
import { securityItems } from "../data/modules";

export function LandingSecurity() {
  return (
    <SectionWrapper id="security">
      <h2 className="text-3xl md:text-4xl font-black text-center text-[#1a1a2e] mb-4">Медицинские данные под защитой</h2>
      <p className="text-center text-[#6b7280] mb-14 max-w-xl mx-auto">Безопасность на каждом уровне</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {securityItems.map((item, i) => (
          <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }}
            className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4"><item.icon size={20} className="text-[#2563eb]" /></div>
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-2">{item.title}</h3>
            <p className="text-xs text-[#9ca3af] leading-relaxed">{item.description}</p>
          </motion.div>
        ))}
      </div>
    </SectionWrapper>
  );
}
