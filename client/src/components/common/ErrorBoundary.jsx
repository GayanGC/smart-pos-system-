import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 m-2 flex flex-col gap-2 shadow-lg shadow-rose-900/20">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Component Crash Detected
          </h2>
          <p className="text-sm font-medium">This module encountered an unexpected runtime error and was safely isolated.</p>
          {this.props.fallbackMessage && (
            <p className="text-xs italic opacity-80">{this.props.fallbackMessage}</p>
          )}
          <details className="mt-2 text-[10px] bg-slate-950 p-3 rounded-lg overflow-x-auto font-mono text-rose-300 border border-rose-900/50">
            <summary className="cursor-pointer font-bold mb-1 opacity-80 hover:opacity-100">View Stack Trace</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo?.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
