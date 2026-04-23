import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { SectionWrapper } from "./SectionWrapper";

export function LandingDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [6, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);
  return (
    <SectionWrapper id="demo">
      <h2 className="text-3xl md:text-4xl font-black text-center text-[#1a1a2e] mb-4">Посмотрите как это работает</h2>
      <p className="text-center text-[#6b7280] mb-14 max-w-xl mx-auto">Единый интерфейс для всей клиники</p>
      <motion.div ref={ref} style={{ rotateX, scale, transformPerspective: 1200 }}
        className="rounded-2xl bg-white border border-gray-200 overflow-hidden shadow-xl">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-300" /><div className="w-3 h-3 rounded-full bg-yellow-300" /><div className="w-3 h-3 rounded-full bg-green-300" /></div>
          <div className="flex-1 mx-4"><div className="h-6 rounded-md bg-white border border-gray-100 flex items-center px-3"><span className="text-[10px] text-[#9ca3af]">app.medcore.kg/dashboard</span></div></div>
        </div>
        <div className="aspect-video bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4"><span className="text-2xl text-[#2563eb]">▶</span></div>
            <p className="text-sm text-[#9ca3af]">Видео-демонстрация платформы</p>
          </div>
        </div>
      </motion.div>
      <div className="text-center mt-8">
        <p className="text-sm text-[#6b7280] mb-4">Хотите персональную демонстрацию?</p>
        <a href="#cta" className="inline-flex h-10 px-6 rounded-xl bg-[#2563eb] items-center text-sm font-semibold text-white hover:bg-[#1d4ed8] transition-colors shadow-lg shadow-blue-500/20">Заказать демо</a>
      </div>
    </SectionWrapper>
  );
}
