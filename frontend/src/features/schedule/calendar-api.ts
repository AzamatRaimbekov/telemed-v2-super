import apiClient from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  doctor_id: string | null;
  patient_id: string | null;
  status: string;
  type: string | null;
}

export interface CalendarDoctor {
  id: string;
  name: string;
  specialization: string | null;
}

export const useCalendarEvents = (params: { doctor_id?: string; date_from?: string; date_to?: string }) =>
  useQuery<CalendarEvent[]>({
    queryKey: ["calendar-events", params],
    queryFn: async () => {
      const { data } = await apiClient.get("/schedule/calendar/events", { params });
      return data;
    },
  });

export const useCalendarDoctors = () =>
  useQuery<CalendarDoctor[]>({
    queryKey: ["calendar-doctors"],
    queryFn: async () => {
      const { data } = await apiClient.get("/schedule/calendar/doctors");
      return data;
    },
  });

export const useReschedule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, new_date, new_time }: { id: string; new_date: string; new_time: string }) => {
      const { data } = await apiClient.put(`/schedule/calendar/${id}/reschedule?new_date=${new_date}&new_time=${new_time}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-events"] }),
  });
};
