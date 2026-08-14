'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Short feature label for the fallback copy ("Note editor crashed"). */
  label?: string;
}

interface State {
  hasError: boolean;
}

// Day 15 Task 1 — a single render crash must never blank the whole app.
// This boundary isolates a crashed subtree (a tab, a modal) and offers a
// recovery path. It also reports the failure through the shared client
// crash channel so production gets a breadcrumb.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('studysnap:crash', {
          detail: { message: error?.message || String(error), componentStack: info?.componentStack },
        })
      );
    }
    console.error('[studysnap] component crashed:', error, info?.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary-inner">
          <h2 className="error-boundary-title">Something went wrong</h2>
          <p className="error-boundary-copy">
            {this.props.label ? `${this.props.label} could not be displayed. ` : ''}
            Your notes are safe — this is just a display issue.
          </p>
          <button type="button" className="error-boundary-action" onClick={this.handleReset}>
            Try again
          </button>
        </div>
      </div>
    );
  }
}