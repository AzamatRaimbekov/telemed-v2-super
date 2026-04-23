import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Trash2, UserPlus } from "lucide-react";
import portalApiClient from "@/lib/portal-api-client";

export const Route = createFileRoute("/portal/_portal/family")({
  component: FamilyPage,
});

const relationLabels: Record<string, string> = {
  child: "Ребёнок",
  parent: "Родитель",
  spouse: "Супруг(а)",
};

function FamilyPage() {
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("child");
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: members } = useQuery({
    queryKey: ["portal-family"],
    queryFn: async () => {
      const { data } = await portalApiClient.get("/portal/family/members");
      return data;
    },
  });

  const linkMember = useMutation({
    mutationFn: async () => {
      await portalApiClient.post("/portal/family/link", { linked_patient_phone: phone, relationship });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-family"] });
      setPhone("");
      setShowForm(false);
    },
  });

  const unlinkMember = useMutation({
    mutationFn: async (linkId: string) => {
      await portalApiClient.delete(`/portal/family/${linkId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portal-family"] }),
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Семейный аккаунт</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Управляйте записями членов семьи</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="h-9 px-4 rounded-xl bg-[var(--color-secondary)] text-white text-sm font-semibold flex items-center gap-2">
          <UserPlus size={16} /> Добавить
        </button>
      </div>

      {showForm && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 shadow-sm space-y-4">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон члена семьи"
            className="w-full h-11 px-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-secondary)]/40" />
          <select value={relationship} onChange={(e) => setRelationship(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none">
            <option value="child">Ребёнок</option>
            <option value="parent">Родитель</option>
            <option value="spouse">Супруг(а)</option>
          </select>
          <button onClick={() => linkMember.mutate()} disabled={!phone || linkMember.isPending}
            className="h-10 px-6 rounded-xl bg-[var(--color-secondary)] text-white text-sm font-semibold disabled:opacity-50">
            Связать аккаунт
          </button>
        </div>
      )}

      <div className="space-y-3">
        {!members?.length ? (
          <div className="text-center py-12">
            <Users size={40} className="mx-auto text-[var(--color-text-tertiary)] mb-3" />
            <p className="text-sm text-[var(--color-text-tertiary)]">Нет связанных аккаунтов</p>
          </div>
        ) : (
          members.map((m: any) => (
            <div key={m.id} className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-secondary)]/10 flex items-center justify-center text-sm font-bold text-[var(--color-secondary)]">
                  {m.linked_patient_name?.[0] || "?"}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{m.linked_patient_name}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{relationLabels[m.relationship] || m.relationship}</p>
                </div>
              </div>
              <button onClick={() => unlinkMember.mutate(m.id)} className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
