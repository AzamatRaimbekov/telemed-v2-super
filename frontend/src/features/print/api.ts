const API_BASE = "/api/v1";

export const printDocument = {
  prescription: (patientId: string, medications: string[]) => {
    const params = new URLSearchParams({ medications: medications.join(",") });
    window.open(`${API_BASE}/print/prescription/${patientId}?${params}`, "_blank");
  },
  discharge: (patientId: string, data: { diagnosis?: string; treatment?: string; recommendations?: string }) => {
    const params = new URLSearchParams(data as Record<string, string>);
    window.open(`${API_BASE}/print/discharge/${patientId}?${params}`, "_blank");
  },
  referral: (patientId: string, data: { to_department?: string; reason?: string }) => {
    const params = new URLSearchParams(data as Record<string, string>);
    window.open(`${API_BASE}/print/referral/${patientId}?${params}`, "_blank");
  },
};
