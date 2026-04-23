import apiClient from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Wristband {
  id: string;
  patient_id: string;
  wristband_uid: string;
  barcode: string | null;
  nfc_tag_id: string | null;
  status: "active" | "deactivated" | "lost" | "discharged";
  issued_at: string;
  issued_by_id: string | null;
  deactivated_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface PatientInfo {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_type: string | null;
  allergies: string[];
  phone: string | null;
  photo_url: string | null;
  status: string | null;
  room_assignment: {
    room_id: string | null;
    bed_number: string | null;
  } | null;
  active_medications: {
    drug_name: string;
    dosage: string;
    frequency: string;
  }[];
}

export interface ScanResult {
  wristband: Wristband;
  patient: PatientInfo;
}

export const useIssueWristband = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { patient_id: string; nfc_tag_id?: string }) => {
      const { data } = await apiClient.post("/wristbands/issue", body);
      return data as Wristband;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wristbands"] });
    },
  });
};

export const useScanWristband = () => {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data } = await apiClient.get(`/wristbands/scan/${encodeURIComponent(code)}`);
      return data as ScanResult;
    },
  });
};

export const usePatientWristband = (patientId: string) =>
  useQuery<Wristband>({
    queryKey: ["wristbands", "patient", patientId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/wristbands/patient/${patientId}`);
      return data;
    },
    enabled: !!patientId,
    retry: false,
  });

export const useWristbandHistory = (patientId: string) =>
  useQuery<Wristband[]>({
    queryKey: ["wristbands", "history", patientId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/wristbands/patient/${patientId}/history`);
      return data;
    },
    enabled: !!patientId,
  });

export const useDeactivateWristband = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data } = await apiClient.post(`/wristbands/${id}/deactivate`, { reason: reason || "discharged" });
      return data as Wristband;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wristbands"] });
    },
  });
};

export const useReportLost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/wristbands/${id}/lost`);
      return data as Wristband;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wristbands"] });
    },
  });
};

export const getWristbandQrUrl = (wristbandId: string) =>
  `/api/v1/wristbands/${wristbandId}/qr`;

export const getWristbandPrintUrl = (wristbandId: string) =>
  `/api/v1/wristbands/${wristbandId}/print`;
