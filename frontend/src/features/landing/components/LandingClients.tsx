import { SectionWrapper } from "./SectionWrapper";
const placeholderClinics = ["Клиника №1", "Мед. центр", "Поликлиника", "Госпиталь"];

export function LandingClients() {
  return (
    <SectionWrapper>
      <h2 className="text-3xl md:text-4xl font-black text-center text-[#1a1a2e] mb-14">Нам доверяют</h2>
      <div className="flex justify-center gap-8 mb-12">
        {placeholderClinics.map((name) => (
          <div key={name} className="w-28 h-14 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity">
            <span className="text-xs text-[#9ca3af] font-medium">{name}</span>
          </div>
        ))}
      </div>
      <blockquote className="max-w-2xl mx-auto text-center">
        <p className="text-lg md:text-xl text-[#6b7280] italic leading-relaxed mb-4">&laquo;MedCore заменил нам 8 разных программ. Теперь всё в одном месте — от регистратуры до лаборатории.&raquo;</p>
        <cite className="text-sm text-[#9ca3af] not-italic">— Главврач, Бишкек</cite>
      </blockquote>
      <div className="text-center mt-8">
        <a href="#cta" className="text-sm text-[#2563eb] hover:text-[#1d4ed8] transition-colors font-medium">Хотите стать одним из первых? →</a>
      </div>
    </SectionWrapper>
  );
}
