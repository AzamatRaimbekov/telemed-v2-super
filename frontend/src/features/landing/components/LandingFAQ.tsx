import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "Сколько стоит подключение?",
    answer: "Мы предлагаем гибкие тарифы в зависимости от размера клиники и набора модулей. Базовое подключение бесплатно — вы платите только за используемые модули. Свяжитесь с нами для расчёта стоимости.",
  },
  {
    question: "Нужен ли собственный сервер?",
    answer: "Нет. MedCore работает в облаке — вам нужен только интернет и любой современный браузер. Все данные хранятся на защищённых серверах с ежедневным резервным копированием.",
  },
  {
    question: "Как происходит обучение персонала?",
    answer: "Мы проводим онлайн-обучение для каждой роли (врачи, медсёстры, регистратура). Обычно 2-3 часа на группу. Также предоставляем видеоинструкции и документацию на русском и кыргызском языках.",
  },
  {
    question: "Можно ли импортировать существующие данные?",
    answer: "Да. Мы поможем перенести данные из Excel, 1С, других программ. Импорт справочников, каталогов лекарств и анализов происходит автоматически.",
  },
  {
    question: "Что если пропадёт интернет?",
    answer: "Критические функции (просмотр карточек, назначения) работают в офлайн-режиме. Данные синхронизируются автоматически при восстановлении подключения.",
  },
  {
    question: "Как обеспечивается безопасность данных?",
    answer: "Шифрование данных (HTTPS, bcrypt), полный аудит действий, 9 ролей доступа с разграничением прав, мультитенантная изоляция данных между клиниками. Соответствие медицинским стандартам хранения данных.",
  },
  {
    question: "Можно ли подключить только часть модулей?",
    answer: "Да. Каждый из 16 модулей работает самостоятельно. Вы можете начать с EHR и расписания, а потом добавить аптеку, лабораторию, мониторинг — по мере необходимости.",
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 px-1 text-left group"
      >
        <span className="text-sm font-semibold text-[#1a1a2e] group-hover:text-[#2563eb] transition-colors pr-4">{question}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={18} className="text-[#9ca3af] flex-shrink-0" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-sm text-[#6b7280] leading-relaxed pb-5 px-1">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LandingFAQ() {
  return (
    <SectionWrapper>
      <h2 className="text-3xl md:text-4xl font-black text-center text-[#1a1a2e] mb-4">Частые вопросы</h2>
      <p className="text-center text-[#6b7280] mb-14 max-w-xl mx-auto">Ответы на вопросы которые задают чаще всего</p>

      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
        {faqs.map((faq) => (
          <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
        ))}
      </div>
    </SectionWrapper>
  );
}
