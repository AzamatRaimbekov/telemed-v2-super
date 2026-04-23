import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { scanQR, usePatientQR } from "@/features/qr/api";
import { Camera, QrCode, Search, User, Phone, Calendar, Printer, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/qr-scan")({
  component: QRScanPage,
});

function QRScanPage() {
  const [patientId, setPatientId] = useState("");
  const [searchId, setSearchId] = useState("");
  const [patient, setPatient] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: qrUrl } = usePatientQR(patient?.id as string || "");

  const handleSearch = async () => {
    if (!patientId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await scanQR(patientId.trim());
      setPatient(data);
      setSearchId(patientId.trim());
    } catch {
      setError("Пациент не найден. Проверьте ID и попробуйте снова.");
      setPatient(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintQR = () => {
    if (!qrUrl) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html><body style="display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;">
          <div style="text-align:center;">
            <img src="${qrUrl}" style="width:300px;height:300px;" />
            <p style="font-size:18px;font-family:sans-serif;margin-top:16px;">ID: ${searchId}</p>
          </div>
        </body></html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="QR Сканер"
        description="Сканирование и поиск пациентов по QR-коду"
      />

      {/* Scanner Area */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-8 mb-6">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-64 h-64 rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-muted)] flex flex-col items-center justify-center mb-6">
            <Camera className="w-16 h-16 text-[var(--color-text-tertiary)] mb-4" />
            <p className="text-sm text-[var(--color-text-secondary)] text-center px-4">
              Наведите камеру на QR-код пациента
            </p>
          </div>

          <div className="w-full max-w-md">
            <p className="text-xs text-[var(--color-text-tertiary)] text-center mb-3 uppercase font-medium tracking-wider">
              или введите ID вручную
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
                <input
                  type="text"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="ID пациента..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-border bg-[var(--color-surface)] text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/30 focus:border-[var(--color-secondary)] transition-all"
                />
              </div>
              <Button
                onClick={handleSearch}
                loading={loading}
                icon={<Search className="w-4 h-4" />}
              >
                Найти
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-xl border border-destructive/20 px-4 py-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Patient Card */}
      {patient && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-6 animate-float-up">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-secondary)]/10 flex items-center justify-center">
                <User className="w-7 h-7 text-[var(--color-secondary)]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {(patient.last_name as string) || ""} {(patient.first_name as string) || ""} {(patient.middle_name as string) || ""}
                </h3>
                <Badge variant="success" dot>Найден</Badge>
              </div>
            </div>
            {qrUrl && (
              <img src={qrUrl} alt="QR" className="w-20 h-20 rounded-lg border border-border" />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              <span className="text-[var(--color-text-secondary)]">Дата рождения:</span>
              <span className="font-medium text-foreground">{(patient.date_of_birth as string) || "---"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              <span className="text-[var(--color-text-secondary)]">Телефон:</span>
              <span className="font-medium text-foreground">{(patient.phone as string) || "---"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <QrCode className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              <span className="text-[var(--color-text-secondary)]">ИНН:</span>
              <span className="font-medium text-foreground">{(patient.inn as string) || "---"}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              icon={<Printer className="w-4 h-4" />}
              onClick={handlePrintQR}
              disabled={!qrUrl}
            >
              Распечатать QR
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<ExternalLink className="w-4 h-4" />}
              onClick={() => window.location.assign(`/patients/${patient.id}`)}
            >
              Открыть профиль
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
