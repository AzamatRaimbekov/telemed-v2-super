import { useState } from "react";
import { Phone, Building2, MessageSquare, Send, Mail } from "lucide-react";
import { SectionWrapper } from "./SectionWrapper";

export function LandingCTA() {
  const [phone, setPhone] = useState("");
  const [clinic, setClinic] = useState("");
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); window.open(`https://wa.me/?text=${encodeURIComponent(`Заявка на демо: ${clinic}, тел: ${phone}`)}`, "_blank"); };
  return (
    <SectionWrapper id="cta" className="bg-gradient-to-br from-[#eff6ff] to-[#f5f3ff]">
      <div className="rounded-3xl bg-white border border-gray-100 shadow-lg p-8 md:p-14 max-w-2xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-black text-center text-[#1a1a2e] mb-3">Готовы к переменам?</h2>
        <p className="text-center text-[#6b7280] mb-10">Бесплатная демонстрация. Настройка за 1 день.</p>
        <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
          <div className="relative">
            <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
            <input type="tel" placeholder="+996 XXX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-[#1a1a2e] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all" />
          </div>
          <div className="relative">
            <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
            <input type="text" placeholder="Название клиники" value={clinic} onChange={(e) => setClinic(e.target.value)}
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-[#1a1a2e] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all" />
          </div>
          <button type="submit" className="w-full h-12 rounded-xl bg-[#2563eb] text-sm font-bold text-white hover:bg-[#1d4ed8] transition-colors shadow-lg shadow-blue-500/25">Заказать демо</button>
        </form>
        <div className="flex justify-center gap-6 mt-8">
          <a href="#" className="flex items-center gap-2 text-xs text-[#9ca3af] hover:text-[#6b7280] transition-colors"><MessageSquare size={14} /> WhatsApp</a>
          <a href="#" className="flex items-center gap-2 text-xs text-[#9ca3af] hover:text-[#6b7280] transition-colors"><Send size={14} /> Telegram</a>
          <a href="mailto:info@medcore.kg" className="flex items-center gap-2 text-xs text-[#9ca3af] hover:text-[#6b7280] transition-colors"><Mail size={14} /> info@medcore.kg</a>
        </div>
      </div>
    </SectionWrapper>
  );
}
