import apiClient from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";

export const usePatientQR = (patientId: string) =>
  useQuery({
    queryKey: ["patient-qr", patientId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/qr/patients/${patientId}/qr`, {
        responseType: "blob",
      });
      return URL.createObjectURL(data);
    },
    enabled: !!patientId,
  });

export const scanQR = async (patientId: string) => {
  const { data } = await apiClient.get(`/qr/scan/${patientId}`);
  return data;
};

/**
 * Universal patient identification — works with any code:
 * wristband UID, QR code, patient ID, INN, phone number.
 */
export const identifyPatient = async (code: string) => {
  const { data } = await apiClient.get(`/qr/identify/${encodeURIComponent(code)}`);
  return data;
};
