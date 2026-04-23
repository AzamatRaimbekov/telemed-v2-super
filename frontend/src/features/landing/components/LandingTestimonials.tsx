import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";
import { Quote } from "lucide-react";

const testimonials = [
  {
    quote: "MedCore заменил нам 8 разных программ. Теперь все данные в одном месте — от регистратуры до лаборатории. Экономим 3 часа в день на документации.",
    name: "Айбек Т.",
    role: "Главврач",
    clinic: "Клиника «Салык», Бишкек",
    color: "#2563eb",
  },
  {
    quote: "Раньше искали карточку пациента по 10 минут. Теперь вся история болезни открывается за секунду. AI-помощник подсказывает назначения по МКБ-10.",
    name: "Гульнара М.",
    role: "Врач-терапевт",
    clinic: "Поликлиника №3, Ош",
    color: "#7c3aed",
  },
  {
    quote: "Мониторинг показателей в реальном времени — это спасение. Алерт приходит мгновенно если SpO2 падает. Раньше узнавали только при обходе.",
    name: "Назгуль А.",
    role: "Старшая медсестра",
    clinic: "Госпиталь, Жалал-Абад",
    color: "#10b981",
  },
  {
    quote: "Пациенты довольны порталом — записываются на приём, смотрят результаты анализов, оплачивают счета. Отток пациентов снизился на 30%.",
    name: "Эркин Б.",
    role: "Директор клиники",
    clinic: "Медцентр «Нур», Каракол",
    color: "#f59e0b",
  },
];

export function LandingTestimonials() {
  return (
    <SectionWrapper className="bg-[#f8f9fb]">
      <h2 className="text-3xl md:text-4xl font-black text-center text-[#1a1a2e] mb-4">Что говорят клиники</h2>
      <p className="text-center text-[#6b7280] mb-14 max-w-xl mx-auto">Реальные отзывы от медицинских учреждений</p>

      <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
        {testimonials.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
          >
            <Quote size={20} style={{ color: t.color }} className="mb-4 opacity-40" />
            <p className="text-sm text-[#6b7280] leading-relaxed mb-5 italic">{"\u00AB"}{t.quote}{"\u00BB"}</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: t.color }}>
                {t.name.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-bold text-[#1a1a2e]">{t.name}</div>
                <div className="text-xs text-[#9ca3af]">{t.role} · {t.clinic}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </SectionWrapper>
  );
}
