import { getStockLimit } from '../lib/catalogHelpers';

/** Stock from Excel catalog — shown on every search result card */
export function PartStockBadge({ stock }: { stock: number | null | undefined }) {
  const qty = getStockLimit(stock);

  if (qty === null) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold">
        Stock: —
      </span>
    );
  }

  if (qty === 0) {
    return (
      <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-100 border border-red-200 text-red-800 text-sm font-bold">
        Out of Stock
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-bold shadow-sm">
      In Stock: <span className="tabular-nums text-base">{qty}</span>
    </span>
  );
}
