import React from 'react';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6 text-center gap-4" dir="rtl">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center text-3xl">⚠️</div>
          <h2 className="text-xl font-bold text-destructive">حدث خطأ غير متوقع</h2>
          <p className="text-sm text-muted-foreground max-w-sm">{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm"
          >
            إعادة تحميل التطبيق
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
