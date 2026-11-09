import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n';

interface State {
  hasError: boolean;
}

/** Last line of defence: a rendering bug shows a friendly message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="notice notice-error" role="alert">
          <p>{t('boundary.message')}</p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            {t('boundary.reload')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
