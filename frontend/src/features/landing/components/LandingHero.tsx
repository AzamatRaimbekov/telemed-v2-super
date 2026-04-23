import { motion, useReducedMotion } from "framer-motion";
import { Heart, Shield, Activity, Stethoscope, Pill, FlaskConical, Brain, Monitor } from "lucide-react";

const floatingIcons = [
  { icon: Heart, color: "#ec4899", x: "8%", y: "18%", delay: 0, size: 20 },
  { icon: Shield, color: "#2563eb", x: "85%", y: "15%", delay: 0.5, size: 18 },
  { icon: Activity, color: "#10b981", x: "12%", y: "72%", delay: 1, size: 16 },
  { icon: Stethoscope, color: "#7c3aed", x: "90%", y: "65%", delay: 1.5, size: 22 },
  { icon: Pill, color: "#f59e0b", x: "5%", y: "45%", delay: 0.8, size: 14 },
  { icon: FlaskConical, color: "#0891b2", x: "92%", y: "40%", delay: 1.2, size: 16 },
  { icon: Brain, color: "#8b5cf6", x: "18%", y: "85%", delay: 0.3, size: 18 },
  { icon: Monitor, color: "#2563eb", x: "80%", y: "82%", delay: 0.7, size: 15 },
];

export function LandingHero() {
  const prefersReducedMotion = useReducedMotion();
  const fadeUp = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 } };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-20 overflow-hidden bg-gradient-to-b from-[#f0f7ff] via-[#f8f0ff]/30 to-white">
      {/* Soft gradient blobs */}
      <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] rounded-full bg-blue-100/50 blur-[100px] pointer-events-none" />
      <div className="absolute top-[200px] left-[-100px] w-[400px] h-[400px] rounded-full bg-purple-100/40 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[100px] right-[10%] w-[300px] h-[300px] rounded-full bg-pink-100/30 blur-[100px] pointer-events-none" />
      <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-50/40 blur-[120px] pointer-events-none" />

      {/* Floating medical icons */}
      {floatingIcons.map(({ icon: Icon, color, x, y, delay, size }, i) => (
        <motion.div
          key={i}
          className="absolute hidden md:flex w-12 h-12 rounded-2xl bg-white/80 backdrop-blur-sm shadow-lg border border-white/50 items-center justify-center"
          style={{ left: x, top: y }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.8 + delay }}
        >
          <motion.div
            animate={prefersReducedMotion ? {} : { y: [0, -8, 0] }}
            transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: delay }}
          >
            <Icon size={size} style={{ color }} />
          </motion.div>
        </motion.div>
      ))}

      {/* Badge */}
      <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }} className="mb-8 relative z-10">
        <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-sm border border-blue-100/50 text-[13px] text-[#2563eb] font-medium shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] animate-pulse" />
          Платформа для клиник нового поколения
        </span>
      </motion.div>

      {/* Headline */}
      <motion.h1 {...fadeUp} transition={{ duration: 0.6, delay: 0.2 }}
        className="relative z-10 text-4xl md:text-6xl lg:text-7xl font-black text-center leading-[1.1] max-w-4xl tracking-tight text-[#1a1a2e]">
        Вся клиника{" "}
        <span className="bg-gradient-to-r from-[#2563eb] to-[#7c3aed] bg-clip-text text-transparent">в одном экране</span>
      </motion.h1>

      {/* Sub */}
      <motion.p {...fadeUp} transition={{ duration: 0.6, delay: 0.3 }}
        className="relative z-10 mt-6 text-base md:text-lg text-[#6b7280] text-center max-w-xl leading-relaxed">
        Замените 10 разных программ одной платформой. EHR, аптека, лаборатория, мониторинг, телемедицина, AI — 16 модулей для вашей клиники.
      </motion.p>

      {/* CTAs */}
      <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.4 }} className="relative z-10 mt-10 flex flex-col sm:flex-row gap-3">
        <a href="#cta"
          className="h-13 px-8 py-3.5 rounded-2xl bg-[#2563eb] flex items-center justify-center text-[15px] font-bold text-white gap-2 shadow-xl shadow-blue-500/25 hover:bg-[#1d4ed8] hover:shadow-2xl hover:shadow-blue-500/30 transition-all hover:-translate-y-0.5">
          Попробовать бесплатно
          <span className="text-lg">→</span>
        </a>
        <a href="#demo"
          className="h-13 px-8 py-3.5 rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-200/80 flex items-center justify-center text-[15px] text-[#6b7280] hover:text-[#1a1a2e] hover:border-gray-300 transition-all gap-2 shadow-sm">
          <span>▶</span> Смотреть демо
        </a>
      </motion.div>

      {/* Dashboard preview mockup */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="relative z-10 w-full max-w-4xl mt-16 mb-8"
      >
        <div className="rounded-2xl bg-white/70 backdrop-blur-xl border border-gray-200/60 shadow-2xl shadow-blue-500/5 overflow-hidden">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50/80 border-b border-gray-100">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-300" />
              <div className="w-3 h-3 rounded-full bg-yellow-300" />
              <div className="w-3 h-3 rounded-full bg-green-300" />
            </div>
            <div className="flex-1 mx-4">
              <div className="h-7 rounded-lg bg-white border border-gray-100 flex items-center px-3">
                <span className="text-xs text-[#9ca3af]">app.medcore.kg/dashboard</span>
              </div>
            </div>
          </div>
          {/* Dashboard content */}
          <div className="p-6 bg-gradient-to-br from-gray-50/50 to-white">
            <div className="grid grid-cols-4 gap-4 mb-4">
              {[
                { label: "Пациенты", value: "1,247", change: "+12%", color: "#2563eb" },
                { label: "Приёмы сегодня", value: "48", change: "+5", color: "#7c3aed" },
                { label: "Загрузка палат", value: "85%", change: "34/40", color: "#10b981" },
                { label: "Анализы готовы", value: "23", change: "из 31", color: "#f59e0b" },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wide">{stat.label}</div>
                  <div className="text-2xl font-extrabold mt-1" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="text-[10px] text-[#10b981] mt-1">{stat.change}</div>
                </div>
              ))}
            </div>
            {/* Chart placeholder */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm h-28 flex items-end gap-1">
              {[40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: `linear-gradient(to top, #2563eb${i % 2 === 0 ? '30' : '15'}, #2563eb${i % 2 === 0 ? '60' : '30'})` }} />
              ))}
            </div>
          </div>
        </div>

        {/* Decorative glow behind dashboard */}
        <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-r from-blue-200/30 via-purple-200/20 to-pink-200/30 blur-2xl" />
      </motion.div>
    </section>
  );
}
