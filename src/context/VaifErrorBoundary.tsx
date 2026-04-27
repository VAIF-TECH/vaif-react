import { Component, type ReactNode, type ErrorInfo } from "react";

/**
 * Props for VaifErrorBoundary
 */
export interface VaifErrorBoundaryProps {
  /** Fallback UI to render on error */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);

  /** Callback when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;

  /** Children to render */
  children: ReactNode;
}

interface VaifErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for VAIF SDK errors
 *
 * Catches errors thrown by VAIF hooks and renders a fallback UI.
 *
 * @example
 * ```tsx
 * <VaifErrorBoundary
 *   fallback={(error, reset) => (
 *     <div>
 *       <p>Something went wrong: {error.message}</p>
 *       <button onClick={reset}>Try Again</button>
 *     </div>
 *   )}
 *   onError={(error) => logError(error)}
 * >
 *   <MyComponent />
 * </VaifErrorBoundary>
 * ```
 */
export class VaifErrorBoundary extends Component<
  VaifErrorBoundaryProps,
  VaifErrorBoundaryState
> {
  constructor(props: VaifErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): VaifErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      const { fallback } = this.props;

      if (typeof fallback === "function") {
        return fallback(this.state.error, this.reset);
      }

      if (fallback) {
        return fallback;
      }

      return null;
    }

    return this.props.children;
  }
}
