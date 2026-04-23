import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";
import { Clock, TrendingUp, FileText, Users } from "lucide-react";

const stats = [
  {
    icon: Clock,
    value: "40%",
    label: "экономия времени",
    description: "Клиники с электронными медкартами тратят на 40% меньше времени на документацию",
    color: "#2563eb",
  },
  {
    icon: TrendingUp,
    value: "3x",
    label: "быстрее обслуживание",
    description: "Единая система ускоряет поиск данных пациента в 3 раза по сравнению с бумажным учётом",
    color: "#10b981",
  },
  {
    icon: FileText,
    value: "0",
    label: "потерянных карточек",
    description: "Электронное хранение исключает потерю медицинских документов и результатов анализов",
    color: "#7c3aed",
  },
  {
    icon: Users,
    value: "92%",
    label: "удовлетворённость",
    description: "Пациенты с доступом к порталу на 92% больше удовлетворены сервисом клиники",
    color: "#f59e0b",
  },
];

export function LandingStats() {
  return (
    <SectionWrapper>
      <h2 className="text-3xl md:text-4xl font-black text-center text-[#1a1a2e] mb-4">Цифры говорят сами</h2>
      <p className="text-center text-[#6b7280] mb-14 max-w-xl mx-auto">Результаты цифровизации в медицине по данным отраслевых исследований</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center"
          >
            <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: `${stat.color}10` }}>
              <stat.icon size={22} style={{ color: stat.color }} />
            </div>
            <div className="text-4xl font-black mb-1" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-sm font-bold text-[#1a1a2e] mb-2">{stat.label}</div>
            <p className="text-xs text-[#9ca3af] leading-relaxed">{stat.description}</p>
          </motion.div>
        ))}
      </div>
    </SectionWrapper>
  );
}
