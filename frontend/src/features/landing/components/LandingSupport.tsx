import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";
import { Headphones, GraduationCap, UserCheck, Clock } from "lucide-react";

const supportFeatures = [
  {
    icon: GraduationCap,
    title: "Обучение персонала",
    description: "Проводим обучение для каждой роли: врачи, медсёстры, регистратура, лаборанты. Видеоинструкции и документация.",
    color: "#2563eb",
  },
  {
    icon: Headphones,
    title: "Техподдержка 24/7",
    description: "Служба поддержки на связи круглосуточно. Среднее время ответа — 15 минут. Решение 95% вопросов за первый звонок.",
    color: "#7c3aed",
  },
  {
    icon: UserCheck,
    title: "Персональный менеджер",
    description: "За каждой клиникой закреплён менеджер, который знает вашу специфику и помогает с настройкой и оптимизацией.",
    color: "#10b981",
  },
  {
    icon: Clock,
    title: "Обновления без простоя",
    description: "Регулярные обновления платформы с новыми функциями. Обновление происходит автоматически, без остановки работы.",
    color: "#0891b2",
  },
];

export function LandingSupport() {
  return (
    <SectionWrapper>
      <h2 className="text-3xl md:text-4xl font-black text-center text-[#1a1a2e] mb-4">Мы рядом на каждом этапе</h2>
      <p className="text-center text-[#6b7280] mb-14 max-w-xl mx-auto">Обучение, поддержка и развитие — не бросаем после подключения</p>

      <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
        {supportFeatures.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex gap-4"
          >
            <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: `${item.color}10` }}>
              <item.icon size={22} style={{ color: item.color }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1a1a2e] mb-1.5">{item.title}</h3>
              <p className="text-xs text-[#6b7280] leading-relaxed">{item.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </SectionWrapper>
  );
}
