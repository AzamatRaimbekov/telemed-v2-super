import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";
import { Check, X, Minus } from "lucide-react";

const features = [
  { name: "Единая база пациентов", manual: false, multiple: "partial", medcore: true },
  { name: "Электронные медкарты (EHR)", manual: false, multiple: "partial", medcore: true },
  { name: "Аптека и складской учёт", manual: false, multiple: true, medcore: true },
  { name: "Лабораторный модуль", manual: false, multiple: "partial", medcore: true },
  { name: "Телемедицина (видеозвонки)", manual: false, multiple: false, medcore: true },
  { name: "IoT мониторинг пациентов", manual: false, multiple: false, medcore: true },
  { name: "AI голосовой ассистент", manual: false, multiple: false, medcore: true },
  { name: "Портал пациента", manual: false, multiple: false, medcore: true },
  { name: "BMS управление зданием", manual: false, multiple: false, medcore: true },
  { name: "Мобильный доступ", manual: false, multiple: "partial", medcore: true },
  { name: "Всё в одном окне", manual: false, multiple: false, medcore: true },
];

function StatusIcon({ value }: { value: boolean | string }) {
  if (value === true) return <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center"><Check size={14} className="text-green-500" /></div>;
  if (value === false) return <div className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center"><X size={14} className="text-red-400" /></div>;
  return <div className="w-6 h-6 rounded-full bg-yellow-50 flex items-center justify-center"><Minus size={14} className="text-yellow-500" /></div>;
}

export function LandingCompare() {
  return (
    <SectionWrapper className="bg-[#f8f9fb]">
      <h2 className="text-3xl md:text-4xl font-black text-center text-[#1a1a2e] mb-4">Сравните сами</h2>
      <p className="text-center text-[#6b7280] mb-14 max-w-xl mx-auto">MedCore vs ручной учёт vs несколько отдельных программ</p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        {/* Header */}
        <div className="grid grid-cols-4 gap-0 border-b border-gray-100 bg-gray-50/80">
          <div className="p-4 text-sm font-bold text-[#1a1a2e]">Функция</div>
          <div className="p-4 text-sm font-medium text-[#9ca3af] text-center">Ручной учёт</div>
          <div className="p-4 text-sm font-medium text-[#9ca3af] text-center">Разные программы</div>
          <div className="p-4 text-sm font-bold text-[#2563eb] text-center bg-blue-50/50">MedCore</div>
        </div>
        {/* Rows */}
        {features.map((f, i) => (
          <div key={f.name} className={`grid grid-cols-4 gap-0 ${i < features.length - 1 ? "border-b border-gray-50" : ""}`}>
            <div className="p-4 text-sm text-[#6b7280]">{f.name}</div>
            <div className="p-4 flex justify-center"><StatusIcon value={f.manual} /></div>
            <div className="p-4 flex justify-center"><StatusIcon value={f.multiple} /></div>
            <div className="p-4 flex justify-center bg-blue-50/30"><StatusIcon value={f.medcore} /></div>
          </div>
        ))}
      </motion.div>
    </SectionWrapper>
  );
}
