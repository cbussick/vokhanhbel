import { Component, type ErrorInfo, type ReactNode } from "react";
import { de } from "../i18n/resources";
import { ErrorScreen } from "./ErrorScreen";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

const fallbackCopy = de.translation.errors.unexpected;

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error", error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorScreen
          actionLabel={fallbackCopy.reload}
          message={fallbackCopy.message}
          onAction={() => window.location.reload()}
          title={fallbackCopy.title}
        />
      );
    }

    return this.props.children;
  }
}
