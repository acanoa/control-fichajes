import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught an error:', error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen grid place-items-center bg-brand-cream/10 p-6">
            <div className="max-w-lg w-full bg-white border border-brand-border rounded-2xl p-6 shadow-sm">
              <h1 className="text-lg font-black text-brand-text">Se ha producido un error al cargar el panel</h1>
              <p className="mt-2 text-sm text-brand-subtext leading-relaxed">
                La sesión se ha abierto correctamente, pero el panel administrativo ha fallado al renderizarse.
                Recarga la página o vuelve a iniciar sesión si el problema persiste.
              </p>
              {this.state.error?.message && (
                <p className="mt-4 text-xs font-mono text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3 break-words">
                  {this.state.error.message}
                </p>
              )}
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
