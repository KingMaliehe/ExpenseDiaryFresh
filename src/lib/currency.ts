// Currency helpers shared across screens.
//
// The user picks a currency in Profile; it's stored on profile.currency (a
// 3-letter ISO code). Everywhere we show money we format via formatMoney so
// the chosen symbol + locale grouping is applied consistently.

export type CurrencyInfo = {
  code: string;
  symbol: string;
  name: string;
  locale: string; // used for thousands grouping
};

// Kept short and practical — the currencies most relevant to this app's users.
// Add more here and they appear in the Profile picker automatically.
export const CURRENCIES: CurrencyInfo[] = [
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', locale: 'en-ZA' },
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'en-IE' },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', locale: 'en-NG' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', locale: 'en-KE' },
  { code: 'BWP', symbol: 'P', name: 'Botswana Pula', locale: 'en-BW' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
];

const DEFAULT = CURRENCIES[0];

export function currencyInfo(code?: string | null): CurrencyInfo {
  if (!code) return DEFAULT;
  return CURRENCIES.find((c) => c.code === code) ?? DEFAULT;
}

// Format an amount for display, e.g. formatMoney(1234.5, 'ZAR') -> "R 1,234.50".
export function formatMoney(
  amount: number,
  code?: string | null,
  opts: { decimals?: boolean } = {},
): string {
  const info = currencyInfo(code);
  const decimals = opts.decimals !== false;
  const n = amount.toLocaleString(info.locale, {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });
  return `${info.symbol} ${n}`;
}
