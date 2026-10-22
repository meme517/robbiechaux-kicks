import { Link } from 'react-router-dom';
import PageMeta from '../components/PageMeta';

export default function NotFound() {
  return (
    <div className="container page">
      <PageMeta title="Page not found" description="The page you were looking for could not be found." />
      <div className="state-panel state-panel--empty">
        <p className="state-panel__code">404</p>
        <h1 className="state-panel__title">Page not found</h1>
        <p>The page you were looking for does not exist or may have moved.</p>
        <div className="state-panel__actions">
          <Link className="btn btn--gold" to="/">
            Back to home
          </Link>
          <Link className="btn btn--ghost-dark" to="/shop">
            Go to the shop
          </Link>
        </div>
      </div>
    </div>
  );
}
