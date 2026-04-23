import { motion } from "framer-motion";
import { Check, Mic, CalendarDays, FlaskConical, Video, Brain, CreditCard, MessageCircle } from "lucide-react";
import { SectionWrapper } from "./SectionWrapper";
import { portalFeatures } from "../data/modules";

const phoneScreenItems = [
  { icon: CalendarDays, label: "Запись к врачу", color: "#2563eb" },
  { icon: FlaskConical, label: "Результаты анализов", color: "#10b981" },
  { icon: Video, label: "Видеоконсультация", color: "#7c3aed" },
  { icon: Brain, label: "Упражнения AI", color: "#f59e0b" },
  { icon: CreditCard, label: "Оплата счетов", color: "#0891b2" },
  { icon: MessageCircle, label: "Чат с врачом", color: "#ec4899" },
];

function PhoneMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative flex justify-center"
    >
      {/* Phone frame */}
      <div className="relative w-[260px] rounded-[32px] bg-white border-[6px] border-gray-200 shadow-2xl shadow-blue-500/10 overflow-hidden">
        {/* Notch */}
        <div className="h-7 bg-gray-50 flex items-center justify-center">
          <div className="w-16 h-4 rounded-full bg-gray-200" />
        </div>
        {/* Screen content */}
        <div className="p-4 space-y-3 bg-gradient-to-b from-gray-50 to-white min-h-[380px]">
          <div className="text-center mb-4">
            <div className="text-xs text-[#9ca3af] font-medium">MedCore KG</div>
            <div className="text-sm font-bold text-[#1a1a2e]">Мой кабинет</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {phoneScreenItems.map((item) => (
              <div key={item.label} className="rounded-xl bg-white border border-gray-100 shadow-sm p-3 flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${item.color}10` }}>
                  <item.icon size={16} style={{ color: item.color }} />
                </div>
                <span className="text-[9px] text-[#6b7280] text-center leading-tight font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Bottom bar */}
        <div className="h-5 bg-white flex items-center justify-center">
          <div className="w-24 h-1 rounded-full bg-gray-200" />
        </div>
      </div>

      {/* Voice bubble */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-4 bottom-20 w-14 h-14 rounded-2xl bg-[#2563eb] flex items-center justify-center shadow-xl shadow-blue-500/30"
      >
        <Mic size={20} className="text-white" />
      </motion.div>

      {/* Decorative glow */}
      <div className="absolute -inset-8 -z-10 rounded-[40px] bg-gradient-to-br from-blue-100/40 via-purple-100/20 to-pink-100/30 blur-2xl" />
    </motion.div>
  );
}

export function LandingPortal() {
  return (
    <SectionWrapper>
      <div className="grid md:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-[#1a1a2e] mb-4">Пациент всегда на связи</h2>
          <p className="text-[#6b7280] mb-8">Личный кабинет с голосовым управлением</p>
          <ul className="space-y-4">{portalFeatures.map((f, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }} className="flex items-start gap-3">
              <div className="mt-0.5 w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0"><Check size={12} className="text-[#2563eb]" /></div>
              <span className="text-sm text-[#6b7280] leading-relaxed">{f}</span>
            </motion.li>
          ))}</ul>
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-100">
            <Mic size={16} className="text-[#2563eb]" /><span className="text-sm text-[#2563eb] font-medium">Голосовой ассистент включён</span>
          </div>
        </div>
        <PhoneMockup />
      </div>
    </SectionWrapper>
  );
}
