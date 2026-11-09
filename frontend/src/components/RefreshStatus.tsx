import { userMessage } from '../api/errors';

interface Props {
  lastUpdated: Date | null;
  error: unknown;
  hasData: boolean;
}

/** Shows when data was last refreshed, and warns (without hiding old data) if refreshing fails. */
export function RefreshStatus({ lastUpdated, error, hasData }: Props) {
  if (error && hasData) {
    return (
      <p className="refresh-status refresh-stale" role="status">
        ⚠ হালনাগাদ করা যাচ্ছে না — শেষ পাওয়া তথ্য দেখানো হচ্ছে। {userMessage(error)}
      </p>
    );
  }
  if (!lastUpdated) return null;
  return (
    <p className="refresh-status">
      স্বয়ংক্রিয়ভাবে হালনাগাদ হচ্ছে · শেষ হালনাগাদ {lastUpdated.toLocaleTimeString('en-GB')}
    </p>
  );
}
