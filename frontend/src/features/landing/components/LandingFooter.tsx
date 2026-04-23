export function LandingFooter() {
  return (
    <footer className="border-t border-gray-100 py-8 px-4 bg-white">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#2563eb] flex items-center justify-center text-xs font-black text-white">M</div>
          <span className="text-sm text-[#9ca3af]">&copy; 2026 MedCore KG. Бишкек, Кыргызстан.</span>
        </div>
        <div className="flex gap-6">
          <a href="/login" className="text-xs text-[#9ca3af] hover:text-[#6b7280] transition-colors">Вход для персонала</a>
          <a href="/portal/login" className="text-xs text-[#9ca3af] hover:text-[#6b7280] transition-colors">Портал пациента</a>
        </div>
      </div>
    </footer>
  );
}
