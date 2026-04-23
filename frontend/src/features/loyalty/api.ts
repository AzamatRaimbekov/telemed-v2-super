import portalClient from "@/lib/portal-api-client";

export const loyaltyApi = {
  getBalance: () =>
    portalClient.get("/loyalty/balance").then((r) => r.data),

  getHistory: (limit = 50) =>
    portalClient.get(`/loyalty/history?limit=${limit}`).then((r) => r.data),

  spendPoints: (amount: number, description: string) =>
    portalClient
      .post("/loyalty/spend", { amount, description })
      .then((r) => r.data),
};
