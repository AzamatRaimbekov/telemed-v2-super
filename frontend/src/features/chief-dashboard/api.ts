import apiClient from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";

export interface ChiefDashboardData {
  patients: { total: number; new_this_month: number; new_this_week: number };
  appointments: {
    today: number;
    this_week: number;
    completed_this_week: number;
    completion_rate: number;
  };
  beds: { total: number; occupied: number; occupancy_rate: number };
  revenue: { this_month: number; last_month: number; growth_percent: number };
  laboratory: { pending_orders: number; completed_today: number };
  pharmacy: { low_stock_items: number; total_items: number };
  staff: { doctors: number; nurses: number; total: number };
}

export const useChiefDashboard = () =>
  useQuery<ChiefDashboardData>({
    queryKey: ["chief-dashboard"],
    queryFn: async () => {
      const { data } = await apiClient.get("/chief-dashboard/");
      return data;
    },
    refetchInterval: 30000,
  });
