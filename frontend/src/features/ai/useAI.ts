import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export function useAI<TInput, TOutput>(
  key: string,
  apiFn: (data: TInput) => Promise<TOutput>,
) {
  const mutation = useMutation({
    mutationKey: ["ai", key],
    mutationFn: apiFn,
    onError: (error: Error) => {
      toast.error(`AI ошибка: ${error.message || "Попробуйте ещё раз"}`);
    },
  });

  return {
    trigger: mutation.mutate,
    triggerAsync: mutation.mutateAsync,
    result: mutation.data ?? null,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
