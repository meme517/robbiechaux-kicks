import { useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageMeta from '../components/PageMeta';
import Price from '../components/Price';
import ProductImage from '../components/ProductImage';
import { storeConfig } from '../config/storeConfig';
import { useCart } from '../context/CartContext';
import { isDemoMode } from '../services/catalogService';
import { buildOrderMessage, storeWhatsappUrl } from '../utils/whatsapp';

export default function Cart() {
  const { items, issues, subtotalRwf, count, updateQuantity, removeByKey, clear, announcement } = useCart();
  const [note, setNote] = useState('');

  const hasUnpriced = items.some((item) => item.priceRwf === null);
  const unavailableCount = items.filter((item) => issues[item.key]?.status === 'unavailable').length;
  const hasUnavailable = unavailableCount > 0;

  const onCheckout = () => {
    if (hasUnavailable) {
      setNote(
        `${unavailableCount} ${unavailableCount === 1 ? 'item needs' : 'items need'} availability confirmation or removal before checkout.`,
      );
      return;
    }
    const url = storeWhatsappUrl(
      buildOrderMessage({
        lines: items.map((item) => ({
          name: item.name,
          sku: item.sku,
          size: item.size,
          quantity: item.quantity,
          unitPrice: item.priceRwf ?? 0,
        })),
        subtotal: subtotalRwf,
        isDemo: isDemoMode(),
      }),
    );
    window.open(url, '_blank', 'noopener,noreferrer');
    setNote('Opening WhatsApp with your order summary. The store will confirm availability, the final total and delivery.');
  };

  return (
    <div className="container page">
      <PageMeta title="Cart" description="Your Robbiechaux Kicks cart. Orders are confirmed with the store on WhatsApp." />

      <header className="page__head">
        <h1 className="page__title">Your cart</h1>
        <p className="page__lead">
          {count > 0
            ? `${count} ${count === 1 ? 'item' : 'items'} in your cart.`
            : 'Your cart is empty.'}
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          message="Add a pair from the Shop page and it will appear here."
        >
          <Link className="btn btn--gold" to="/shop">
            Shop shoes
          </Link>
        </EmptyState>
      ) : (
        <div className="cart-layout">
          <ul className="cart-list">
            {items.map((item) => {
              const displayName = item.name;
              const problem = issues[item.key];
              return (
                <li
                  className={`cart-item${problem ? ' cart-item--flagged' : ''}`}
                  key={item.key}
                >
                  <Link className="cart-item__media" to={`/product/${item.productId}`} aria-label={`View ${displayName}`}>
                    <ProductImage src={item.imageUrl} alt={displayName} width={112} height={84} />
                  </Link>

                  <div className="cart-item__info">
                    <h2 className="cart-item__title">
                      <Link to={`/product/${item.productId}`}>{displayName}</Link>
                    </h2>
                    {item.size && <p className="cart-item__size">Size: {item.size}</p>}
                    <Price value={item.priceRwf} />
                    {problem?.issue && <p className="cart-item__warn">{problem.issue}</p>}
                    {item.priceRwf === null && !problem && (
                      <p className="cart-item__warn">Price to be confirmed by the store.</p>
                    )}
                  </div>

                  <div className="cart-item__qty">
                    <label htmlFor={`qty-${item.key}`}>Qty</label>
                    <div className="qty-control">
                      <button
                        type="button"
                        className="qty-control__btn"
                        aria-label={`Decrease quantity of ${displayName}`}
                        onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                      >
                        −
                      </button>
                      <input
                        id={`qty-${item.key}`}
                        className="qty-control__input"
                        type="number"
                        min={1}
                        max={99}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.key, Number(e.target.value))}
                      />
                      <button
                        type="button"
                        className="qty-control__btn"
                        aria-label={`Increase quantity of ${displayName}`}
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button type="button" className="link-button" onClick={() => removeByKey(item.key)}>
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="cart-summary" aria-labelledby="cart-summary-heading">
            <h2 id="cart-summary-heading" className="cart-summary__title">
              Summary
            </h2>
            <div className="cart-summary__row">
              <span>Subtotal</span>
              <Price value={subtotalRwf} />
            </div>
            <p className="cart-summary__note">
              Delivery charges are confirmed by the store and are not calculated here.
            </p>
            {hasUnavailable && (
              <p className="cart-summary__warn" role="alert">
                {unavailableCount} {unavailableCount === 1 ? 'item needs' : 'items need'} availability
                confirmation or removal before checkout.
              </p>
            )}
            {hasUnpriced && (
              <p className="cart-summary__warn">
                One or more items have no confirmed price yet — the store will confirm the final total.
              </p>
            )}

            <button
              type="button"
              className="btn btn--gold btn--lg btn--block"
              onClick={onCheckout}
              disabled={hasUnavailable}
            >
              Order on WhatsApp
            </button>
            <button type="button" className="btn btn--ghost-dark btn--block" onClick={clear}>
              Clear cart
            </button>
            <Link className="cart-summary__continue" to="/shop">
              Continue shopping
            </Link>

            <p className="cart-summary__store">
              Orders are arranged with {storeConfig.storeName} on WhatsApp. No online payment is taken
              on this site.
            </p>
          </aside>
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {note && <p className="fine-print" role="status" aria-live="polite">{note}</p>}
    </div>
  );
}
