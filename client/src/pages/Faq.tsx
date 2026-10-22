import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import { storeConfig } from '../config/storeConfig';

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Where is Robbiechaux Kicks located?',
    a: (
      <>
        We are at <strong>{storeConfig.location.label}</strong>. You are welcome to visit during
        opening hours.
      </>
    ),
  },
  {
    q: 'What kinds of shoes do you sell?',
    a: 'We stock sneakers, loafers, formal shoes, slides and clogs. What is listed on the Shop page is what is currently available.',
  },
  {
    q: 'How do I know a price is real?',
    a: 'Prices are shown in Rwandan francs (RWF) and are set by the store for published inventory. The final total is always confirmed by the store before you commit.',
  },
  {
    q: 'Do you deliver?',
    a: (
      <>
        Yes — we deliver to <strong>{storeConfig.delivery.area}</strong>. Delivery charges and timing
        depend on your location, so contact us on WhatsApp for a quote.
      </>
    ),
  },
  {
    q: 'Can I pay online?',
    a: 'No online payment is taken on this website. Orders are arranged directly with the store on WhatsApp or by phone, and payment is agreed with the store.',
  },
  {
    q: 'Can I return or exchange a pair?',
    a: 'Return and exchange terms are set by the store and confirmed when you order. Please ask us on WhatsApp before buying if you need specific terms.',
  },
  {
    q: 'Are the product photos of the actual stock?',
    a: 'Where an image is provider catalog artwork rather than a photo of the physical pair, the product page says so.',
  },
  {
    q: 'The site is showing demo products — what does that mean?',
    a: 'While the catalog is being set up, the site may display clearly labelled demo records. They are design placeholders only and are not confirmed store inventory.',
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="container page">
      <PageMeta
        title="FAQ"
        description="Frequently asked questions about Robbiechaux Kicks — location, product range, RWF prices, delivery to Kigali and nearby areas, payment and returns."
      />

      <header className="page__head">
        <h1 className="page__title">Frequently asked questions</h1>
        <p className="page__lead">
          Still stuck? <Link to="/contact">Contact the store</Link> and we will help.
        </p>
      </header>

      <ul className="faq-list">
        {FAQS.map((item, index) => {
          const isOpen = open === index;
          return (
            <li className="faq-item" key={item.q}>
              <h2 className="faq-item__heading">
                <button
                  type="button"
                  className="faq-item__button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${index}`}
                  id={`faq-trigger-${index}`}
                  onClick={() => setOpen(isOpen ? null : index)}
                >
                  <span>{item.q}</span>
                  <span className="faq-item__icon" aria-hidden="true">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
              </h2>
              <div
                className="faq-item__panel"
                id={`faq-panel-${index}`}
                role="region"
                aria-labelledby={`faq-trigger-${index}`}
                hidden={!isOpen}
              >
                <p>{item.a}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
