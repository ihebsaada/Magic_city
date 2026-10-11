export function checkoutLink(orderId: string, configuredOrigin = import.meta.env.VITE_CHECKOUT_ORIGIN ?? 'https://dripcheckout.netlify.app'): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(orderId)) throw new Error('INVALID_ORDER');
  const origin = new URL(configuredOrigin);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' ||
    (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)))) throw new Error('INVALID_CHECKOUT_ORIGIN');
  return `${origin.origin}/checkout-landing?orderId=${encodeURIComponent(orderId)}`;
}
