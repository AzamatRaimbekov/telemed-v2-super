import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { patientsApi } from "@/features/patients/api";
import {
  useIssueWristband,
  useScanWristband,
  useDeactivateWristband,
  useReportLost,
  getWristbandQrUrl,
  getWristbandPrintUrl,
  type ScanResult,
  type Wristband,
} from "@/features/wristbands/api";
import {
  Search,
  User,
  Phone,
  Calendar,
  Printer,
  ExternalLink,
  XCircle,
  AlertTriangle,
  Tag,
  Scan,
  Plus,
  Droplets,
  Pill,
  DoorOpen,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/wristbands")({
  component: WristbandsPage,
});

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Активен" },
  deactivated: { bg: "bg-gray-100", text: "text-gray-600", label: "Деактивирован" },
  lost: { bg: "bg-red-100", text: "text-red-700", label: "Утерян" },
  discharged: { bg: "bg-blue-100", text: "text-blue-700", label: "Выписан" },
};

const bloodTypeDisplay: Record<string, string> = {
  A_POS: "A+",
  A_NEG: "A-",
  B_POS: "B+",
  B_NEG: "B-",
  AB_POS: "AB+",
  AB_NEG: "AB-",
  O_POS: "O+",
  O_NEG: "O-",
  UNKNOWN: "---",
};

function WristbandsPage() {
  const [scanInput, setScanInput] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);

  // Issue form state
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [nfcTagId, setNfcTagId] = useState("");

  const scanInputRef = useRef<HTMLInputElement>(null);

  const scanMutation = useScanWristband();
  const issueMutation = useIssueWristband();
  const deactivateMutation = useDeactivateWristband();
  const reportLostMutation = useReportLost();

  // Patient search for issuing
  const { data: patientsData } = useQuery({
    queryKey: ["patients-search", patientSearch],
    queryFn: () => patientsApi.list({ search: patientSearch, limit: 10 }),
    enabled: patientSearch.length >= 2,
  });

  // Auto-focus scan input
  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  const handleScan = async () => {
    if (!scanInput.trim()) return;
    setScanError(null);
    try {
      const result = await scanMutation.mutateAsync(scanInput.trim());
      setScanResult(result);
      setRecentScans((prev) => [result, ...prev.filter((r) => r.wristband.id !== result.wristband.id)].slice(0, 10));
      setScanInput("");
    } catch {
      setScanError("Браслет не найден или неактивен. Проверьте код и попробуйте снова.");
      setScanResult(null);
    }
  };

  const handleIssue = async () => {
    if (!selectedPatientId) return;
    try {
      const wb = await issueMutation.mutateAsync({
        patient_id: selectedPatientId,
        nfc_tag_id: nfcTagId || undefined,
      });
      // Auto-scan the newly issued wristband
      try {
        const result = await scanMutation.mutateAsync(wb.wristband_uid);
        setScanResult(result);
        setRecentScans((prev) => [result, ...prev].slice(0, 10));
      } catch {
        // Scan may fail if we're fast, just show the wristband data
      }
      setShowIssueForm(false);
      setSelectedPatientId("");
      setPatientSearch("");
      setNfcTagId("");
    } catch {
      setScanError("Ошибка при выдаче браслета.");
    }
  };

  const handleDeactivate = async (wbId: string) => {
    await deactivateMutation.mutateAsync({ id: wbId, reason: "discharged" });
    setScanResult(null);
  };

  const handleReportLost = async (wbId: string) => {
    await reportLostMutation.mutateAsync(wbId);
    setScanResult(null);
  };

  const handlePrint = (wbId: string) => {
    const url = getWristbandPrintUrl(wbId);
    const token = localStorage.getItem("access_token");
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.text())
        .then((html) => {
          printWindow.document.write(html);
          printWindow.document.close();
          setTimeout(() => printWindow.print(), 300);
        });
    }
  };

  const patients = patientsData?.items || patientsData || [];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Браслеты пациентов"
        description="Выдача, сканирование и управление идентификационными браслетами"
      />

      {/* Scan Section */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-secondary)]/10 flex items-center justify-center">
            <Scan className="w-5 h-5 text-[var(--color-secondary)]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Сканирование браслета</h2>
            <p className="text-xs text-[var(--color-text-tertiary)]">Отсканируйте или введите код браслета</p>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
            <input
              ref={scanInputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              placeholder="MC-XXXXXX, штрихкод или NFC..."
              className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-border bg-[var(--color-surface)] text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/30 focus:border-[var(--color-secondary)] transition-all font-mono text-base"
              autoFocus
            />
          </div>
          <Button
            onClick={handleScan}
            loading={scanMutation.isPending}
            icon={<Search className="w-4 h-4" />}
          >
            Найти
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowIssueForm(!showIssueForm)}
            icon={<Plus className="w-4 h-4" />}
          >
            Выдать
          </Button>
        </div>
      </div>

      {/* Issue Form */}
      {showIssueForm && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-6 mb-6 animate-float-up">
          <h3 className="text-sm font-semibold text-foreground mb-4">Выдать новый браслет</h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">
                Поиск пациента
              </label>
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  setSelectedPatientId("");
                }}
                placeholder="Введите ФИО пациента..."
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-border bg-[var(--color-surface)] text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/30 focus:border-[var(--color-secondary)] transition-all"
              />
              {Array.isArray(patients) && patients.length > 0 && !selectedPatientId && (
                <div className="mt-2 border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {patients.map((p: Record<string, unknown>) => (
                    <button
                      key={p.id as string}
                      onClick={() => {
                        setSelectedPatientId(p.id as string);
                        setPatientSearch(`${p.last_name} ${p.first_name} ${p.middle_name || ""}`);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--color-muted)] transition-colors flex items-center gap-3 border-b border-border/50 last:border-0"
                    >
                      <User className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                      <span className="font-medium">{p.last_name as string} {p.first_name as string} {(p.middle_name as string) || ""}</span>
                      {p.date_of_birth && (
                        <span className="text-xs text-[var(--color-text-tertiary)] ml-auto">{p.date_of_birth as string}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">
                NFC Tag ID (необязательно)
              </label>
              <input
                type="text"
                value={nfcTagId}
                onChange={(e) => setNfcTagId(e.target.value)}
                placeholder="NFC UID..."
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-border bg-[var(--color-surface)] text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/30 focus:border-[var(--color-secondary)] transition-all font-mono"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleIssue}
                loading={issueMutation.isPending}
                disabled={!selectedPatientId}
              >
                Выдать браслет
              </Button>
              <Button variant="ghost" onClick={() => setShowIssueForm(false)}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Scan Error */}
      {scanError && (
        <div className="bg-destructive/10 text-destructive rounded-xl border border-destructive/20 px-4 py-3 mb-6 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {scanError}
        </div>
      )}

      {/* Scan Result — Patient Card */}
      {scanResult && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-6 mb-6 animate-float-up">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-secondary)]/10 flex items-center justify-center">
                <User className="w-7 h-7 text-[var(--color-secondary)]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {scanResult.patient.last_name} {scanResult.patient.first_name} {scanResult.patient.middle_name || ""}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={scanResult.wristband.status} />
                  <span className="text-sm font-mono text-[var(--color-text-secondary)] bg-[var(--color-muted)] px-2 py-0.5 rounded-lg">
                    {scanResult.wristband.wristband_uid}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <img
                src={getWristbandQrUrl(scanResult.wristband.id)}
                alt="QR"
                className="w-20 h-20 rounded-lg border border-border"
                crossOrigin="use-credentials"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          </div>

          {/* Patient Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            <InfoRow icon={<Calendar className="w-4 h-4" />} label="Дата рождения" value={scanResult.patient.date_of_birth || "---"} />
            <InfoRow icon={<Phone className="w-4 h-4" />} label="Телефон" value={scanResult.patient.phone || "---"} />
            <InfoRow
              icon={<Droplets className="w-4 h-4" />}
              label="Группа крови"
              value={bloodTypeDisplay[scanResult.patient.blood_type || ""] || "---"}
            />
            {scanResult.patient.room_assignment && (
              <InfoRow
                icon={<DoorOpen className="w-4 h-4" />}
                label="Палата"
                value={scanResult.patient.room_assignment.bed_number ? `Кровать ${scanResult.patient.room_assignment.bed_number}` : "Назначена"}
              />
            )}
          </div>

          {/* Allergies */}
          {scanResult.patient.allergies && scanResult.patient.allergies.length > 0 && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">Аллергии</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {scanResult.patient.allergies.map((a, i) => (
                  <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Active Medications */}
          {scanResult.patient.active_medications && scanResult.patient.active_medications.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Pill className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Активные назначения</span>
              </div>
              <div className="space-y-1.5">
                {scanResult.patient.active_medications.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm px-3 py-2 bg-[var(--color-muted)] rounded-lg">
                    <span className="font-medium text-foreground">{m.drug_name}</span>
                    <span className="text-[var(--color-text-tertiary)]">{m.dosage}</span>
                    <span className="text-[var(--color-text-tertiary)]">{m.frequency}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              icon={<Printer className="w-4 h-4" />}
              onClick={() => handlePrint(scanResult.wristband.id)}
            >
              Печать этикетки
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<ExternalLink className="w-4 h-4" />}
              onClick={() => window.location.assign(`/patients/${scanResult.patient.id}`)}
            >
              Профиль пациента
            </Button>
            {scanResult.wristband.status === "active" && (
              <>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<AlertTriangle className="w-4 h-4" />}
                  onClick={() => handleReportLost(scanResult.wristband.id)}
                  loading={reportLostMutation.isPending}
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                >
                  Утерян
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<XCircle className="w-4 h-4" />}
                  onClick={() => handleDeactivate(scanResult.wristband.id)}
                  loading={deactivateMutation.isPending}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Деактивировать
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Недавние сканирования</h3>
          <div className="space-y-2">
            {recentScans.map((scan) => (
              <button
                key={scan.wristband.id}
                onClick={() => setScanResult(scan)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-[var(--color-muted)] transition-colors flex items-center gap-4 border border-border/50"
              >
                <div className="w-9 h-9 rounded-xl bg-[var(--color-secondary)]/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-[var(--color-secondary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {scan.patient.last_name} {scan.patient.first_name}
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)] font-mono">
                    {scan.wristband.wristband_uid}
                  </p>
                </div>
                <StatusBadge status={scan.wristband.status} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = statusColors[status] || statusColors.deactivated;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-[var(--color-text-tertiary)]">{icon}</span>
      <span className="text-[var(--color-text-secondary)]">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
