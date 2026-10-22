import { formatRWF } from '../utils/currency';

interface PriceProps {
  value: number | null;
  compareAt?: number | null;
  className?: string;
}

/** Renders a numeric RWF amount with consistent formatting. */
export default function Price({ value, compareAt = null, className = '' }: PriceProps) {
  const onSale =
    value !== null && compareAt !== null && Number.isFinite(compareAt) && compareAt > value;
  return (
    <span className={`price ${className}`.trim()}>
      <span className="price__current">{formatRWF(value)}</span>
      {onSale && <span className="price__compare">{formatRWF(compareAt)}</span>}
    </span>
  );
}
