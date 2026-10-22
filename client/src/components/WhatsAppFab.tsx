import { storeConfig } from '../config/storeConfig';
import { generalGreetingMessage, storeWhatsappUrl } from '../utils/whatsapp';

/** Small, unobtrusive floating WhatsApp shortcut. */
export default function WhatsAppFab() {
  return (
    <a
      className="wa-fab"
      href={storeWhatsappUrl(generalGreetingMessage())}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with ${storeConfig.storeName} on WhatsApp`}
    >
      <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.7c-2 0-3.9-.5-5.5-1.6l-.4-.2-3.9 1 1-3.8-.2-.4A10.7 10.7 0 1 1 16 26.7zm5.9-8c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.7 8.7 0 0 1-4.3-3.8c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.6l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4a3.7 3.7 0 0 0-1.1 2.7 6.4 6.4 0 0 0 1.3 3.3 14.6 14.6 0 0 0 5.6 4.9c.8.3 1.4.5 1.8.7a4.3 4.3 0 0 0 2 .1 3.2 3.2 0 0 0 2.1-1.5 2.6 2.6 0 0 0 .2-1.5c-.1-.2-.3-.3-.6-.4z"
        />
      </svg>
    </a>
  );
}
