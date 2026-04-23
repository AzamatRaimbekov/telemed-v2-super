// features/signatures/api.ts — API client for electronic document signature endpoints
import apiClient from "@/lib/api-client";

export interface DocumentSignature {
  id: string;
  document_id: string | null;
  document_type: string;
  document_title: string;
  signer_id: string;
  signer_name: string;
  signer_role: string;
  signature_hash: string | null;
  pin_code_verified: boolean;
  status: "pending" | "signed" | "rejected" | "expired";
  signed_at: string | null;
  ip_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignDocumentRequest {
  document_id?: string;
  document_type: string;
  document_title: string;
  pin_code: string;
}

export interface SignatureVerifyResult {
  valid: boolean;
  signature: DocumentSignature | null;
  message: string;
}

export const signaturesApi = {
  sign: (data: SignDocumentRequest): Promise<DocumentSignature> =>
    apiClient.post("/signatures/sign", data).then((r) => r.data),

  list: (params?: {
    signer_id?: string;
    document_type?: string;
    status?: string;
    limit?: number;
  }): Promise<DocumentSignature[]> => {
    const q = new URLSearchParams();
    if (params?.signer_id) q.set("signer_id", params.signer_id);
    if (params?.document_type) q.set("document_type", params.document_type);
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit));
    return apiClient.get(`/signatures/?${q}`).then((r) => r.data);
  },

  getById: (id: string): Promise<DocumentSignature> =>
    apiClient.get(`/signatures/${id}`).then((r) => r.data),

  verify: (hash: string): Promise<SignatureVerifyResult> =>
    apiClient.get(`/signatures/verify/${hash}`).then((r) => r.data),
};
