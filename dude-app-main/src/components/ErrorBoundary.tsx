import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public props: Props;
  public state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[1000] bg-background flex items-center justify-center p-6 text-center">
          <div className="w-full max-w-sm space-y-8">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center">
                <AlertTriangle size={40} />
              </div>
            </div>
            
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">Ops! Algo deu errado.</h1>
              <p className="text-text-secondary font-light">
                O aplicativo encontrou um erro inesperado. Não se preocupe, seus dados estão seguros.
              </p>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-primary-green text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(110,231,168,0.2)] hover:bg-glow-green transition-all"
            >
              <RefreshCcw size={14} /> Recarregar Aplicativo
            </button>

            {true && (
              <div className="mt-8 p-4 bg-surface/50 border border-border-white/10 rounded-xl text-left overflow-auto max-h-64">
                <p className="text-[10px] font-mono text-red-400 break-words font-bold">
                  {this.state.error?.message}
                </p>
                <p className="text-[10px] font-mono text-red-400 break-words mt-2">
                  {this.state.error?.stack}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
