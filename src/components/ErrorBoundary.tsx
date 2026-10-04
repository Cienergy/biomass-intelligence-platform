import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { error: string | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(err: Error) {
    return { error: err.message || String(err) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI crash:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback || (
          <div className="state error">
            Something went wrong loading this section: {this.state.error}
          </div>
        )
      );
    }
    return this.props.children;
  }
}
