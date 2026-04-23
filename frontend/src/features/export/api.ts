import apiClient from "@/lib/api-client";

export const downloadExcel = async (type: "patients" | "appointments" | "payments") => {
  const response = await apiClient.get(`/export/${type}/excel`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${type}-${new Date().toISOString().split("T")[0]}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
