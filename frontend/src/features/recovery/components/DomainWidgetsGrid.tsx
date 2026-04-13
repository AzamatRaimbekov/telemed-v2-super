import type { DomainScore } from "../types";
import { DomainWidget } from "./DomainWidget";

interface Props {
  domains: DomainScore[];
}

export function DomainWidgetsGrid({ domains }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {domains.map((d) => (
        <DomainWidget key={d.domain} domainScore={d} />
      ))}
    </div>
  );
}
