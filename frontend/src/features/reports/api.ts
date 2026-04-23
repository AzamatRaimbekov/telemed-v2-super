import apiClient from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";

export interface DoctorEfficiency {
  doctor_id: string;
  doctor_name: string;
  specialty: string;
  appointments_count: number;
  completed_count: number;
  completion_rate: number;
  avg_per_day: number;
}

export interface DoctorRanking {
  doctor_id: string;
  doctor_name: string;
  specialty: string;
  score: number;
  appointments_count: number;
}

export interface DepartmentLoad {
  department_id: string;
  department_name: string;
  total_beds: number;
  occupied_beds: number;
  occupancy_rate: number;
  admissions_today: number;
  discharges_today: number;
}

export interface DepartmentSummary {
  total_departments: number;
  total_beds: number;
  total_occupied: number;
  overall_occupancy: number;
}

export interface PLEntry {
  month: string;
  revenue: number;
  billed: number;
  expenses: number;
  profit: number;
}

export interface DailyRevenue {
  date: string;
  revenue: number;
  transactions: number;
}

export const useDoctorEfficiency = () =>
  useQuery<DoctorEfficiency[]>({
    queryKey: ["reports", "doctors", "efficiency"],
    queryFn: async () => {
      const { data } = await apiClient.get("/reports/doctors/efficiency");
      return data;
    },
  });

export const useDoctorRanking = () =>
  useQuery<DoctorRanking[]>({
    queryKey: ["reports", "doctors", "ranking"],
    queryFn: async () => {
      const { data } = await apiClient.get("/reports/doctors/ranking");
      return data;
    },
  });

export const useDepartmentLoad = () =>
  useQuery<DepartmentLoad[]>({
    queryKey: ["reports", "departments", "load"],
    queryFn: async () => {
      const { data } = await apiClient.get("/reports/departments/load");
      return data;
    },
  });

export const useDepartmentSummary = () =>
  useQuery<DepartmentSummary>({
    queryKey: ["reports", "departments", "summary"],
    queryFn: async () => {
      const { data } = await apiClient.get("/reports/departments/summary");
      return data;
    },
  });

export const usePL = () =>
  useQuery<PLEntry[]>({
    queryKey: ["reports", "financial", "pl"],
    queryFn: async () => {
      const { data } = await apiClient.get("/reports/financial/pl");
      return data;
    },
  });

export const useDailyRevenue = () =>
  useQuery<DailyRevenue[]>({
    queryKey: ["reports", "financial", "daily"],
    queryFn: async () => {
      const { data } = await apiClient.get("/reports/financial/daily");
      return data;
    },
  });
