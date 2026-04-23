import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";
import { monitoringStats } from "../data/modules";
import { Heart, Thermometer, Activity, ShieldAlert, Wifi } from "lucide-react";

const sensors = [
  { icon: Heart, label: "Пульс", value: "72 bpm", x: "10%", y: "22%", color: "#ef4444" },
  { icon: Activity, label: "SpO2", value: "98%", x: "68%", y: "15%", color: "#10b981" },
  { icon: Thermometer, label: "Темп.", value: "36.6°", x: "78%", y: "58%", color: "#7c3aed" },
  { icon: ShieldAlert, label: "Падение", value: "Норма", x: "15%", y: "68%", color: "#f59e0b" },
];

function RoomIllustration() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative w-full max-w-2xl mx-auto h-[300px] md:h-[360px]"
    >
      {/* Room */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-50 to-purple-50/50 border border-gray-100 overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-gray-100/50 to-transparent" />
        <div className="absolute bottom-[25%] left-[30%] w-[40%] h-[20%] rounded-xl bg-white border border-gray-200 shadow-sm" />
        <div className="absolute bottom-[35%] left-[28%] w-[12%] h-[8%] rounded-lg bg-blue-100 border border-blue-200" />
        <div className="absolute top-[10%] right-[10%] w-[20%] h-[30%] rounded-xl bg-gradient-to-b from-sky-100 to-blue-50 border border-gray-200" />
      </div>

      {/* Sensors */}
      {sensors.map((sensor, i) => (
        <motion.div
          key={sensor.label}
          className="absolute"
          style={{ left: sensor.x, top: sensor.y }}
          initial={{ opacity: 0, scale: 0 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 + i * 0.15 }}
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 2.5 + i * 0.3, repeat: Infinity, ease: "easeInOut" }}
            className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 shadow-lg px-3 py-2"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${sensor.color}12` }}>
              <sensor.icon size={16} style={{ color: sensor.color }} />
            </div>
            <div>
              <div className="text-[9px] text-[#9ca3af] font-medium">{sensor.label}</div>
              <div className="text-xs font-bold text-[#1a1a2e]">{sensor.value}</div>
            </div>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: sensor.color }} />
          </motion.div>
        </motion.div>
      ))}

      {/* Central hub */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="w-14 h-14 rounded-2xl bg-[#2563eb] flex items-center justify-center shadow-xl shadow-blue-500/25"
        >
          <Wifi size={22} className="text-white" />
        </motion.div>
      </div>
    </motion.div>
  );
}

export function LandingMonitoring() {
  return (
    <SectionWrapper className="bg-[#f8f9fb]">
      <h2 className="text-3xl md:text-4xl font-black text-center text-[#1a1a2e] mb-4">Умная палата в реальном времени</h2>
      <p className="text-center text-[#6b7280] mb-10 max-w-xl mx-auto">Каждый датчик на контроле. Каждый алерт — мгновенно.</p>

      <RoomIllustration />

      <div className="flex flex-wrap justify-center gap-3 mt-8">
        {monitoringStats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.08 }}
            className="px-5 py-2.5 rounded-xl bg-white border border-gray-100 shadow-sm">
            <span className="text-xs font-semibold mr-2" style={{ color: s.color }}>{s.label}</span>
            <span className="text-sm font-extrabold text-[#1a1a2e]">{s.value}</span>
          </motion.div>
        ))}
      </div>
      <p className="text-center text-xs text-[#9ca3af] mt-6">10 типов датчиков · Алерты за &lt;1 сек · WebSocket real-time · Кнопка вызова медсестры</p>
    </SectionWrapper>
  );
}
