import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { navLinks } from "../data/modules";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/80 backdrop-blur-xl shadow-sm border-b border-gray-100"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-16">
        <a href="#" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#2563eb] flex items-center justify-center text-sm font-black text-white shadow-lg shadow-blue-500/20">
            M
          </div>
          <span className="text-[15px] font-bold text-[#1a1a2e]">
            MedCore<span className="text-[#9ca3af] font-normal ml-1">KG</span>
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-[13px] text-[#6b7280] hover:text-[#1a1a2e] transition-colors font-medium">
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <a href="/login" className="text-[13px] text-[#6b7280] hover:text-[#1a1a2e] transition-colors font-medium">Войти</a>
          <a href="#cta" className="h-9 px-5 rounded-xl bg-[#2563eb] flex items-center text-[13px] font-semibold text-white hover:bg-[#1d4ed8] transition-colors shadow-lg shadow-blue-500/20">
            Заказать демо
          </a>
        </div>

        <button className="md:hidden text-[#6b7280]" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="md:hidden bg-white/95 backdrop-blur-xl border-b border-gray-100 px-6 pb-6">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
              className="block py-3 text-sm text-[#6b7280] hover:text-[#1a1a2e]">{link.label}</a>
          ))}
          <div className="flex gap-3 mt-4">
            <a href="/login" className="text-sm text-[#6b7280]">Войти</a>
            <a href="#cta" onClick={() => setMobileOpen(false)}
              className="h-9 px-5 rounded-xl bg-[#2563eb] flex items-center text-sm font-semibold text-white">Заказать демо</a>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}
