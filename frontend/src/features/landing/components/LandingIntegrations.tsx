import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";
import { integrations } from "../data/modules";

export function LandingIntegrations() {
  return (
    <SectionWrapper className="bg-[#f8f9fb]">
      <h2 className="text-3xl md:text-4xl font-black text-center text-[#1a1a2e] mb-4">Работает с тем, что у вас уже есть</h2>
      <p className="text-center text-[#6b7280] mb-14 max-w-xl mx-auto">Интеграции с оборудованием и сервисами</p>
      <div className="flex flex-wrap justify-center gap-5">
        {integrations.map((item, i) => (
          <motion.div key={item.name} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.05 }}
            className="flex flex-col items-center gap-2.5 w-20">
            <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center hover:shadow-md hover:border-blue-200 transition-all">
              <item.icon size={22} className="text-[#6b7280]" />
            </div>
            <span className="text-[10px] text-[#9ca3af] text-center leading-tight">{item.name}</span>
          </motion.div>
        ))}
      </div>
    </SectionWrapper>
  );
}
