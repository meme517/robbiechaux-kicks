import { useEffect, useState } from 'react';
import ContactForm from '../components/ContactForm';
import PageMeta from '../components/PageMeta';
import { storeConfig } from '../config/storeConfig';
import { fetchContactStatus } from '../services/contactService';
import { generalGreetingMessage, storeWhatsappUrl } from '../utils/whatsapp';

export default function Contact() {
  const [formAvailable, setFormAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetchContactStatus()
      .then((status) => {
        if (active) setFormAvailable(status.available);
      })
      .catch(() => {
        if (active) setFormAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="container page">
      <PageMeta
        title="Contact"
        description="Contact Robbiechaux Kicks — Downtown, Room L3-51, Kigali, Rwanda. Message or call +250 793 314 037 (WhatsApp) or +250 723 437 804. Delivery to Kigali and nearby areas."
      />

      <header className="page__head">
        <h1 className="page__title">Contact us</h1>
        <p className="page__lead">
          Ask about availability, sizing, prices or delivery. WhatsApp is the fastest way to reach the
          store.
        </p>
      </header>

      <div className="contact-layout">
        <section className="contact-details" aria-labelledby="contact-details-heading">
          <h2 id="contact-details-heading" className="section__title">
            Store details
          </h2>

          <dl className="contact-list">
            <dt>Location</dt>
            <dd>{storeConfig.location.label}</dd>

            <dt>Phone (primary / WhatsApp)</dt>
            <dd>
              <a href={`tel:${storeConfig.phones.primary.international}`}>
                {storeConfig.phones.primary.label}
              </a>
            </dd>

            <dt>Phone (secondary)</dt>
            <dd>
              <a href={`tel:${storeConfig.phones.secondary.international}`}>
                {storeConfig.phones.secondary.label}
              </a>
            </dd>

            <dt>Instagram</dt>
            <dd>
              <a href={storeConfig.instagram.url} target="_blank" rel="noopener noreferrer">
                {storeConfig.instagram.handle}
              </a>
            </dd>

            <dt>Delivery</dt>
            <dd>{storeConfig.delivery.area} — charges and timing confirmed by the store.</dd>

            <dt>Email</dt>
            <dd className="muted">{storeConfig.email} (to be added by the store)</dd>
          </dl>

          <a
            className="btn btn--gold btn--lg btn--block"
            href={storeWhatsappUrl(generalGreetingMessage())}
            target="_blank"
            rel="noopener noreferrer"
          >
            Chat on WhatsApp
          </a>
        </section>

        <section className="contact-panel" aria-labelledby="contact-form-heading">
          <h2 id="contact-form-heading" className="section__title">
            Send a message
          </h2>

          {formAvailable === null && <p className="muted">Checking message form availability…</p>}

          {formAvailable === true && <ContactForm />}

          {formAvailable === false && (
            <div className="state-panel state-panel--info">
              <p>
                The online message form is not enabled yet. Please reach the store on WhatsApp or by
                phone and we will be happy to help.
              </p>
              <a
                className="btn btn--gold"
                href={storeWhatsappUrl(generalGreetingMessage())}
                target="_blank"
                rel="noopener noreferrer"
              >
                Chat on WhatsApp
              </a>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
