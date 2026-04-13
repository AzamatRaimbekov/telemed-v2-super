import { useState } from "react";
import { useRecoveryData } from "../hooks/useRecoveryData";
import { RecoveryIndexCard } from "./RecoveryIndexCard";
import { DomainWidgetsGrid } from "./DomainWidgetsGrid";
import type { PeriodKey } from "../types";

interface Props {
  patientId: string;
}

export function RecoveryDashboard({ patientId }: Props) {
  const [periodKey, setPeriodKey] = useState<PeriodKey>("30d");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const { recoveryIndex, isLoading } = useRecoveryData(
    patientId,
    periodKey,
    customFrom,
    customTo
  );

  function handlePeriodChange(key: PeriodKey, from?: Date, to?: Date) {
    setPeriodKey(key);
    setCustomFrom(from);
    setCustomTo(to);
  }

  return (
    <div className="space-y-3">
      <RecoveryIndexCard
        index={recoveryIndex}
        isLoading={isLoading}
        periodKey={periodKey}
        onPeriodChange={handlePeriodChange}
      />
      {recoveryIndex && (
        <DomainWidgetsGrid domains={recoveryIndex.domains} />
      )}
    </div>
  );
}
