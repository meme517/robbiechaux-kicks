import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { storeConfig } from '../config/storeConfig';
import { storeWhatsappUrl } from '../utils/whatsapp';

interface EmptyStateProps {
  title: string;
  message: string;
  children?: ReactNode;
}

/** Honest empty-state panel for empty catalog and empty cart cases. */
export default function EmptyState({ title, message, children }: EmptyStateProps) {
  return (
    <div className="state-panel state-panel--empty">
      <h2 className="state-panel__title">{title}</h2>
      <p>{message}</p>
      <div className="state-panel__actions">
        {children ?? (
          <>
            <Link className="btn btn--gold" to="/shop">
              Browse the shop
            </Link>
            <a
              className="btn btn--ghost-dark"
              href={storeWhatsappUrl(
                `Hello ${storeConfig.storeName}! I would like to know what shoes you currently have in store.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ask on WhatsApp
            </a>
          </>
        )}
      </div>
    </div>
  );
}
