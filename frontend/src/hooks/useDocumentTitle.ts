import { useEffect } from 'react';
import { t, useLang } from '../i18n';

/** Sets the browser tab title, e.g. "আমার আবেদন · স্কুল ভর্তি", in the current language. */
export function useDocumentTitle(pageTitle: string): void {
  const { lang } = useLang();
  useEffect(() => {
    const appName = t('app.short');
    document.title = pageTitle ? `${pageTitle} · ${appName}` : appName;
  }, [pageTitle, lang]);
}
