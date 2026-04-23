import apiClient from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";

export interface ForecastPoint {
  date: string;
  predicted: number;
  low: number;
  high: number;
}

export interface MedicationAlert {
  item_id: string;
  name: string;
  current_quantity: number;
  daily_consumption: number;
  days_until_empty: number;
  reorder_date: string;
  urgency: "critical" | "warning" | "info";
}

export interface PredictionsDashboard {
  beds: ForecastPoint[];
  admissions: ForecastPoint[];
  medications: MedicationAlert[];
}

export const usePredictionsDashboard = () =>
  useQuery<PredictionsDashboard>({
    queryKey: ["predictions-dashboard"],
    queryFn: async () => {
      const { data } = await apiClient.get("/predictions/dashboard");
      return data;
    },
    refetchInterval: 300000, // 5 min
  });
