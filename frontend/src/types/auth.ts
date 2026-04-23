export type UserRole =
  | "SUPER_ADMIN"
  | "CLINIC_ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "PHARMACIST"
  | "RECEPTIONIST"
  | "LAB_TECHNICIAN"
  | "PATIENT"
  | "GUARDIAN";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  specialization: string | null;
  department_id: string | null;
  clinic_id: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  permissions?: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
