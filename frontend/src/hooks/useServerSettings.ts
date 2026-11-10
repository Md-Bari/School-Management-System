import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { ServerSettings } from '../api/types';

/** Assumed until /settings answers (or if it can't be reached): the brief's default behaviour. */
export const DEFAULT_SETTINGS: ServerSettings = { holdDurationSeconds: 600, oneAdmissionPerStudent: false };

/**
 * The backend's configuration (GET /settings). Fetched once per page and retried on the next
 * mount if it failed; failures fall back to DEFAULT_SETTINGS so the UI always works.
 */
export function useServerSettings(): ServerSettings {
  const [settings, setSettings] = useState<ServerSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;
    api
      .settings()
      .then((s) => {
        if (active && s) setSettings({ ...DEFAULT_SETTINGS, ...s });
      })
      .catch(() => {
        // keep defaults
      });
    return () => {
      active = false;
    };
  }, []);

  return settings;
}
