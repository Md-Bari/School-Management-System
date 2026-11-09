import type { HoldStatus } from '../api/types';
import { STATUS_LABELS } from '../lib/holdStatus';

export function StatusBadge({ status }: { status: HoldStatus }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`} data-status={status}>
      {STATUS_LABELS[status]} <span className="badge-code">({status})</span>
    </span>
  );
}
