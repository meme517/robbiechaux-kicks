import { Link } from 'react-router-dom';

interface ErrorStateProps {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
}

export default function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div className="state-panel state-panel--error" role="alert">
      <h2 className="state-panel__title">{title}</h2>
      <p>{message}</p>
      <div className="state-panel__actions">
        {onRetry && (
          <button type="button" className="btn btn--gold" onClick={onRetry}>
            Try again
          </button>
        )}
        <Link className="btn btn--ghost-dark" to="/contact">
          Contact the store
        </Link>
      </div>
    </div>
  );
}
