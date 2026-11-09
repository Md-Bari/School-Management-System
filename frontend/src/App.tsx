import { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StudentIdBar } from './components/StudentIdBar';
import { useDocumentTitle } from './hooks/useDocumentTitle';
import { routeHref, useHashRoute, type Route } from './hooks/useHashRoute';
import { useStudentId } from './hooks/useStudentId';
import { t, useLang, type MessageKey } from './i18n';
import { ClassListPage } from './pages/ClassListPage';
import { CreateClassPage } from './pages/CreateClassPage';
import { HoldPage } from './pages/HoldPage';
import { MyHoldsPage } from './pages/MyHoldsPage';

const NAV: { route: Route; label: MessageKey }[] = [
  { route: { name: 'classes' }, label: 'nav.classes' },
  { route: { name: 'my' }, label: 'nav.my' },
  { route: { name: 'admin' }, label: 'nav.admin' },
];

const TITLES: Record<Route['name'], MessageKey> = {
  classes: 'nav.classes',
  my: 'nav.my',
  admin: 'nav.admin',
  hold: 'holdPage.title',
};

export function App() {
  const route = useHashRoute();
  const [studentId, setStudentId] = useStudentId();
  // Subscribing here re-renders the whole app when the language changes.
  const { lang, setLang } = useLang();
  useDocumentTitle(t(TITLES[route.name]));

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-top">
          <h1>{t('app.title')}</h1>
          <button
            type="button"
            className="lang-switch"
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            aria-label={t('lang.switchLabel')}
            title={t('lang.switchLabel')}
          >
            <span aria-hidden="true">🌐</span> {t('lang.switchTo')}
          </button>
        </div>
        <StudentIdBar studentId={studentId} onChange={setStudentId} />
        <nav className="tabs" aria-label={t('nav.label')}>
          {NAV.map((item) => (
            <a
              key={item.route.name}
              href={routeHref(item.route)}
              className={`tab${route.name === item.route.name ? ' tab-active' : ''}`}
              aria-current={route.name === item.route.name ? 'page' : undefined}
            >
              {t(item.label)}
            </a>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {/* Keyed by route so a crash on one page can be recovered by navigating away. */}
        <ErrorBoundary key={routeHref(route)}>
          {route.name === 'classes' && <ClassListPage studentId={studentId} />}
          {route.name === 'my' && <MyHoldsPage studentId={studentId} />}
          {route.name === 'admin' && <CreateClassPage />}
          {route.name === 'hold' && <HoldPage holdId={route.holdId} studentId={studentId} />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
