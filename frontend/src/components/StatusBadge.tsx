import type { HoldStatus } from '../api/types';
import { statusLabel } from '../lib/holdStatus';

export function StatusBadge({ status }: { status: HoldStatus }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`} data-status={status}>
      {statusLabel(status)} <span className="badge-code">({status})</span>
    </span>
  );
}
