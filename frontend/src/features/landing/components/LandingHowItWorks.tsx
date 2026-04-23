import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";
import { MessageSquare, Settings, Rocket } from "lucide-react";

const steps = [
  {
    icon: MessageSquare,
    number: "01",
    title: "Заявка и демо",
    description: "Оставьте заявку — мы покажем платформу в действии и обсудим потребности вашей клиники. Бесплатно и без обязательств.",
    color: "#2563eb",
  },
  {
    icon: Settings,
    number: "02",
    title: "Настройка за 1 день",
    description: "Мы настраиваем систему под вашу клинику: отделения, роли, справочники, шаблоны документов. Импорт существующих данных.",
    color: "#7c3aed",
  },
  {
    icon: Rocket,
    number: "03",
    title: "Запуск и обучение",
    description: "Обучаем персонал, подключаем оборудование, запускаем в работу. Техподдержка на связи 24/7 с первого дня.",
    color: "#10b981",
  },
];

export function LandingHowItWorks() {
  return (
    <SectionWrapper className="bg-[#f8f9fb]">
      <h2 className="text-3xl md:text-4xl font-black text-center text-[#1a1a2e] mb-4">Начать — просто</h2>
      <p className="text-center text-[#6b7280] mb-14 max-w-xl mx-auto">Три шага от заявки до работающей системы</p>

      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {steps.map((step, i) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.15 }}
            className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-7 text-center"
          >
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-gray-200" />
            )}
            <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: `${step.color}10` }}>
              <step.icon size={24} style={{ color: step.color }} />
            </div>
            <div className="text-xs font-bold text-[#9ca3af] uppercase tracking-widest mb-2">{step.number}</div>
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-2">{step.title}</h3>
            <p className="text-sm text-[#6b7280] leading-relaxed">{step.description}</p>
          </motion.div>
        ))}
      </div>
    </SectionWrapper>
  );
}
