import React, { type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class FeatureErrorBoundary extends React.Component<Props, State> {
  declare readonly props: Readonly<Props>;
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error('Analytics feature failed to load:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-slate-600">
          <p>Analytics could not be loaded.</p>
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-white" onClick={() => window.location.reload()}>
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
