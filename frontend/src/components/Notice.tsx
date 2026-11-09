import type { ReactNode } from 'react';

type Kind = 'info' | 'success' | 'error' | 'warning';

interface Props {
  kind?: Kind;
  children: ReactNode;
  onClose?: () => void;
}

/** Inline message box. Errors use role="alert" so screen readers announce them. */
export function Notice({ kind = 'info', children, onClose }: Props) {
  return (
    <div className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <div className="notice-body">{children}</div>
      {onClose && (
        <button type="button" className="notice-close" onClick={onClose} aria-label="বন্ধ করুন">
          ×
        </button>
      )}
    </div>
  );
}
