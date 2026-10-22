import { storeConfig } from '../config/storeConfig';
import type { Product } from '../types/product';

/** Build a wa.me link with a URL-encoded pre-filled message. */
export function whatsappUrl(whatsappDigits: string, message: string): string {
  const digits = String(whatsappDigits || '').replace(/\D/g, '');
  const text = encodeURIComponent(message || '');
  return `https://wa.me/${digits}${text ? `?text=${text}` : ''}`;
}

export function storeWhatsappUrl(message: string): string {
  return whatsappUrl(storeConfig.phones.primary.whatsapp ?? '', message);
}

export function generalGreetingMessage(): string {
  return `Hello ${storeConfig.storeName}! I found your website and I would like to ask about your shoes.`;
}

export function displayName(product: Pick<Product, 'brand' | 'name'>): string {
  return product.brand ? `${product.brand} ${product.name}` : product.name;
}

interface OrderLine {
  name: string;
  sku?: string | null;
  size?: string | null;
  quantity: number;
  unitPrice: number;
}

function lineLabel(line: OrderLine): string {
  const size = line.size ? ` — size ${line.size}` : '';
  const sku = line.sku ? ` (SKU ${line.sku})` : '';
  return `${line.quantity}x ${line.name}${size}${sku}`;
}

export function buildOrderMessage(args: {
  lines: OrderLine[];
  subtotal: number;
  isDemo: boolean;
}): string {
  const parts: string[] = [];
  if (args.isDemo) {
    parts.push('[DEMO PREVIEW — this is NOT a real order. Demo products and prices are placeholders.]');
    parts.push('');
  }
  parts.push(`Hello ${storeConfig.storeName}! I would like to order the following:`);
  parts.push('');
  args.lines.forEach((line, index) => {
    parts.push(`${index + 1}. ${lineLabel(line)} — ${formatPlain(line.unitPrice)}`);
  });
  parts.push('');
  parts.push(`Subtotal: ${formatPlain(args.subtotal)}`);
  parts.push('');
  parts.push(
    'Please confirm availability, delivery charges and the final total. Delivery location: Kigali.',
  );
  return parts.join('\n');
}

function formatPlain(amount: number): string {
  if (!Number.isFinite(amount)) return 'price on request';
  return `RWF ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)}`;
}

export function productOrderMessage(
  product: Product,
  size: string | null,
  quantity = 1,
  isDemo = false,
): string {
  if (product.provider === 'serpapi') {
    const parts = [
      `Hello ${storeConfig.storeName}! I found this Google Shopping listing on your website:`,
      '',
      `Product: ${displayName(product)}`,
      ...(size ? [`Requested size: ${size}`] : ['Requested size: please advise']),
      `Reference price: ${formatPlain(product.priceRwf ?? 0)} (please confirm your store price)`,
      '',
      'Please confirm the local availability, final price and delivery charges before I order.',
    ];
    if (isDemo) parts.unshift('[DEMO PREVIEW — this is not a real order.]', '');
    return parts.join('\n');
  }

  const unitPrice = product.priceRwf ?? 0;
  return buildOrderMessage({
    lines: [
      {
        name: displayName(product),
        sku: product.sku ?? null,
        size,
        quantity,
        unitPrice,
      },
    ],
    subtotal: unitPrice * quantity,
    isDemo,
  });
}
