import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Phone, Mail, Clock, Car, Building2 } from "lucide-react";
import portalApiClient from "@/lib/portal-api-client";

export const Route = createFileRoute("/portal/_portal/clinic-info")({
  component: ClinicInfoPage,
});

function ClinicInfoPage() {
  const { data: info } = useQuery({
    queryKey: ["portal-clinic-info"],
    queryFn: async () => {
      const { data } = await portalApiClient.get("/portal/clinic-info");
      return data;
    },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">О клинике</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Как нас найти и связаться</p>
      </div>

      {/* Map embed */}
      <div className="rounded-2xl overflow-hidden border border-blue-100 h-48">
        <iframe
          src="https://maps.google.com/maps?q=42.8746,74.5698&z=15&output=embed"
          className="w-full h-full rounded-2xl"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      {/* Map links */}
      <div className="flex flex-wrap gap-2">
        <a href="https://2gis.kg/bishkek" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors">
          <MapPin size={14} /> 2GIS
        </a>
        <a href="https://maps.google.com/?q=42.8746,74.5698" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors">
          <MapPin size={14} /> Google Maps
        </a>
        <a href="https://yandex.kg/maps/?ll=74.5698,42.8746&z=16" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors">
          <MapPin size={14} /> Яндекс Карты
        </a>
      </div>

      {/* Contact cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><MapPin size={18} className="text-blue-500" /></div>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Адрес</span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">{info?.address || "г. Бишкек, ул. Манаса 42"}</p>
        </div>

        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center"><Phone size={18} className="text-green-500" /></div>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Телефон</span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">{info?.phone || "+996 312 123456"}</p>
        </div>

        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center"><Mail size={18} className="text-purple-500" /></div>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Email</span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">{info?.email || "info@medcore.kg"}</p>
        </div>

        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center"><Clock size={18} className="text-amber-500" /></div>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Время работы</span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">Пн-Пт: 8:00 - 18:00</p>
          <p className="text-sm text-[var(--color-text-secondary)]">Сб: 9:00 - 14:00</p>
        </div>
      </div>

      {/* Extra info */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <Car size={18} className="text-[var(--color-text-tertiary)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Парковка</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Бесплатная парковка на 30 мест перед зданием</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Building2 size={18} className="text-[var(--color-text-tertiary)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Этажи</p>
            <p className="text-xs text-[var(--color-text-secondary)]">1 этаж — Регистратура, Аптека · 2 этаж — Врачи · 3 этаж — Лаборатория, Процедурный</p>
          </div>
        </div>
      </div>
    </div>
  );
}
