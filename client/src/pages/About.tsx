import { Link } from 'react-router-dom';
import PageMeta from '../components/PageMeta';

export default function About() {
  return (
    <div className="container page">
      <PageMeta
        title="About"
        description="About Robbiechaux Kicks — a footwear store in Downtown, Room L3-51, Kigali, Rwanda, offering sneakers, loafers, formal shoes, slides and clogs with delivery to Kigali and nearby areas."
      />

      <header className="page__head">
        <h1 className="page__title">About Robbiechaux Kicks</h1>
        <p className="page__lead">Step in. Stand out.</p>
      </header>

      <section className="prose">
        <h2>Who we are</h2>
        <p>
          Robbiechaux Kicks is a shoe store in Kigali, Rwanda. We stock a range of footwear for
          everyday and special occasions — sneakers, loafers, formal shoes, slides and clogs — chosen
          for people who want to step in and stand out.
        </p>

        <h2>Where to find us</h2>
        <p>
          You can visit us at <strong>Downtown, Room L3-51, Kigali, Rwanda</strong>. If you would
          rather talk first, message or call us and we will tell you what is currently available.
        </p>

        <h2>How we work</h2>
        <p>
          We keep the listings here honest: a pair is only shown as available when it is part of our
          verified inventory, with an RWF price confirmed by the store. Where a product image is
          catalog artwork rather than a photo of the physical pair, we say so.
        </p>
        <p>
          Orders are arranged directly with us on WhatsApp or by phone. Availability, the final total
          and delivery are always confirmed by the store before anything is agreed.
        </p>

        <h2>Delivery</h2>
        <p>
          We deliver to Kigali and nearby areas. Delivery charges and timing depend on where you are,
          so contact us for a quote rather than assuming a fixed fee or date.
        </p>

        <div className="prose__actions">
          <Link className="btn btn--gold" to="/shop">
            Shop shoes
          </Link>
          <Link className="btn btn--ghost-dark" to="/contact">
            Contact us
          </Link>
        </div>
      </section>
    </div>
  );
}
