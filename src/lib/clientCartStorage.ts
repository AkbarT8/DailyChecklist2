export interface StoredCartPart {
  id: string;
  part_number: string;
  brand: string;
  description: string;
  category: string;
  price: number | null;
  stock: number | null;
  coo: string | null;
  extra: Record<string, unknown>;
}

export interface StoredCartItem {
  part: StoredCartPart;
  qty: number;
}

const STORAGE_PREFIX = 'papco_client_cart_v1:';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadClientCart(userId: string): StoredCartItem[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StoredCartItem =>
        !!item
        && typeof item === 'object'
        && typeof (item as StoredCartItem).qty === 'number'
        && !!(item as StoredCartItem).part?.id,
    );
  } catch {
    return [];
  }
}

export function saveClientCart(userId: string, items: StoredCartItem[]): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(items));
  } catch {
    // ignore quota / private mode
  }
}

export function clearClientCart(userId: string): void {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}
