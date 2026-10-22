export default function StockBadge({ status }: { status: 'in_stock' | 'low_stock' | 'out_of_stock' | string }) {
  return <span className={`stock-badge stock-badge--${status}`}>{status.replace(/_/g, ' ')}</span>;
}
