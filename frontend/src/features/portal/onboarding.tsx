import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, FlaskConical, Mic, Heart, X, ChevronRight } from "lucide-react";

const steps = [
  { icon: Heart, title: "Добро пожаловать!", description: "Это ваш личный кабинет. Здесь вы найдёте всё о вашем здоровье — медкарту, приёмы, анализы и многое другое.", color: "#2563eb" },
  { icon: CalendarDays, title: "Запись к врачу", description: "Запишитесь на приём к любому специалисту. Выберите удобное время и получите напоминание.", color: "#7c3aed" },
  { icon: FlaskConical, title: "Результаты анализов", description: "Как только врач утвердит результаты — вы сразу увидите их здесь. Никаких очередей за бумажками.", color: "#10b981" },
  { icon: Mic, title: "Голосовой ассистент", description: "Скажите «Запишись к терапевту» или «Покажи анализы» — ассистент всё сделает за вас.", color: "#f59e0b" },
];

export function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("portal_onboarding_completed")) {
      setShow(true);
    }
  }, []);

  const complete = () => {
    localStorage.setItem("portal_onboarding_completed", "true");
    setShow(false);
  };

  if (!show) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 relative"
        >
          <button onClick={complete} className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>

          <div className="text-center">
            <motion.div
              key={step}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ background: `${current.color}15` }}>
                <current.icon size={28} style={{ color: current.color }} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">{current.title}</h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-8">{current.description}</p>
            </motion.div>

            {/* Dots */}
            <div className="flex justify-center gap-2 mb-6">
              {steps.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? "bg-blue-500" : "bg-gray-200"}`} />
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={complete} className="flex-1 h-11 rounded-xl border border-gray-200 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                Пропустить
              </button>
              <button
                onClick={() => isLast ? complete() : setStep(step + 1)}
                className="flex-1 h-11 rounded-xl bg-blue-500 text-sm font-semibold text-white hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
              >
                {isLast ? "Начать" : "Далее"} {!isLast && <ChevronRight size={16} />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
