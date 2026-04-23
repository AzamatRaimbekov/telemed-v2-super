// features/fiscal/api.ts — API client for KKM fiscal receipt endpoints
import apiClient from "@/lib/api-client";

export interface FiscalReceipt {
  id: string;
  payment_id: string | null;
  receipt_number: string | null;
  fiscal_sign: string | null;
  fiscal_document_number: string | null;
  fn_serial: string | null;
  receipt_url: string | null;
  amount: number;
  status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiscalRegisterRequest {
  payment_id: string;
  amount: number;
  description?: string;
}

export const fiscalApi = {
  register: (data: FiscalRegisterRequest): Promise<FiscalReceipt> =>
    apiClient.post("/fiscal/register", data).then((r) => r.data),

  getReceipts: (params?: {
    status?: string;
    limit?: number;
  }): Promise<FiscalReceipt[]> => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit));
    return apiClient.get(`/fiscal/receipts?${q}`).then((r) => r.data);
  },

  getReceipt: (id: string): Promise<FiscalReceipt> =>
    apiClient.get(`/fiscal/receipts/${id}`).then((r) => r.data),

  getByPayment: (paymentId: string): Promise<FiscalReceipt> =>
    apiClient.get(`/fiscal/payment/${paymentId}`).then((r) => r.data),

  retry: (id: string): Promise<FiscalReceipt> =>
    apiClient.post(`/fiscal/receipts/${id}/retry`).then((r) => r.data),
};
