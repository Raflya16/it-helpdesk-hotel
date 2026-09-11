import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message:
        error instanceof Error
          ? error.message
          : "Terjadi error yang tidak terduga.",
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Unhandled application error:", error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="app-error-boundary">
        <div className="card app-error-card">
          <div className="app-error-icon">
            <AlertTriangle size={26} />
          </div>
          <h1>Halaman mengalami masalah</h1>
          <p>
            Aplikasi tidak dapat menampilkan halaman ini dengan benar. Data Anda tidak
            otomatis terhapus. Muat ulang halaman untuk mencoba kembali.
          </p>
          {this.state.message && (
            <details>
              <summary>Detail teknis</summary>
              <pre>{this.state.message}</pre>
            </details>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={17} />
            Muat Ulang
          </button>
        </div>
      </main>
    );
  }
}
