import { useEffect } from 'react';

const APP_NAME = 'স্কুল ভর্তি';

/** Sets the browser tab title, e.g. "আমার আবেদন · স্কুল ভর্তি". */
export function useDocumentTitle(pageTitle: string): void {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · ${APP_NAME}` : APP_NAME;
  }, [pageTitle]);
}
