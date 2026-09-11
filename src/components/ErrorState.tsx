import { AlertTriangle, RefreshCw } from "lucide-react";

export function ErrorState({
  message,
  onRetry,
  title = "Data tidak dapat dimuat",
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="card error-state" role="alert">
      <div className="error-state-icon" aria-hidden="true">
        <AlertTriangle size={22} />
      </div>
      <div className="error-state-copy">
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRetry}
        >
          <RefreshCw size={16} />
          Coba Lagi
        </button>
      )}
    </div>
  );
}
