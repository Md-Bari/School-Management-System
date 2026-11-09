import { ErrorBoundary } from './components/ErrorBoundary';
import { StudentIdBar } from './components/StudentIdBar';
import { useDocumentTitle } from './hooks/useDocumentTitle';
import { routeHref, useHashRoute, type Route } from './hooks/useHashRoute';
import { useStudentId } from './hooks/useStudentId';
import { ClassListPage } from './pages/ClassListPage';
import { CreateClassPage } from './pages/CreateClassPage';
import { HoldPage } from './pages/HoldPage';
import { MyHoldsPage } from './pages/MyHoldsPage';

const NAV: { route: Route; label: string }[] = [
  { route: { name: 'classes' }, label: 'Class তালিকা' },
  { route: { name: 'my' }, label: 'আমার আবেদন' },
  { route: { name: 'admin' }, label: 'Class তৈরি (Admin)' },
];

const TITLES: Record<Route['name'], string> = {
  classes: 'Class তালিকা',
  my: 'আমার আবেদন',
  admin: 'Class তৈরি',
  hold: 'আবেদন',
};

export function App() {
  const route = useHashRoute();
  const [studentId, setStudentId] = useStudentId();
  useDocumentTitle(TITLES[route.name]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>স্কুল ভর্তি — অনলাইন আবেদন</h1>
        <StudentIdBar studentId={studentId} onChange={setStudentId} />
        <nav className="tabs" aria-label="প্রধান মেনু">
          {NAV.map((item) => (
            <a
              key={item.route.name}
              href={routeHref(item.route)}
              className={`tab${route.name === item.route.name ? ' tab-active' : ''}`}
              aria-current={route.name === item.route.name ? 'page' : undefined}
            >
              {item.label}
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
