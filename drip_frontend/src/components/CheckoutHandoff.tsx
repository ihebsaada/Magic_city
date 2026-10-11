import { useState } from 'react';
import { apiPost } from '@/services/api';
import { orderAccessToken } from '@/lib/checkoutAttempt';
import { checkoutErrorMessage } from '@/lib/checkoutAttempt';
import { checkoutLink } from '@/lib/handoffLink';
import { HttpError } from '@/services/request';

type Pairing = { pairingId: string; orderId: string; phrase: string; state: string };
export function CheckoutHandoff({ orderId }: { orderId: string }) {
  const [code, setCode] = useState('');
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function run(approve: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const token = orderAccessToken(orderId);
      if (!token || !/^[A-Za-z0-9_-]{32}$/.test(code)) throw new Error('INVALID_PAIRING');
      if (approve && (!pairing || pairing.pairingId !== code)) throw new Error('INVALID_PAIRING');
      const result = await apiPost<Pairing>(`/orders/${encodeURIComponent(orderId)}/handoffs/${code}/${approve ? 'approve' : 'inspect'}`, {}, {
        headers: { 'Order-Access-Token': token }, cache: 'no-store', timeoutMs: 15000,
      });
      if (result.orderId !== orderId || result.pairingId !== code || !/^[a-f0-9]{4}(?:-[a-f0-9]{4}){2}$/.test(result.phrase)) throw new Error('INVALID_PAIRING');
      if (approve && (!pairing || pairing.phrase !== result.phrase)) throw new Error('INVALID_PAIRING');
      setPairing(result);
      setMessage(result.state === 'approved' ? 'Autorizzato. Torna alla stessa scheda Checkout e premi Verifica autorizzazione.' : 'Confronta il codice di controllo con quello della scheda Checkout prima di autorizzare.');
    } catch (error) {
      const messages: Record<number, string> = {
        401: 'Accesso o abbinamento non valido. Serve un recupero verificato se i dati sono persi.',
        403: 'Origine non autorizzata. Verifica la configurazione dello staging.',
        409: 'Abbinamento in conflitto. Non creare un altro ordine.',
        410: 'Abbinamento scaduto. Nel Checkout prepara esplicitamente un nuovo abbinamento per questo ordine.',
        429: 'Troppe richieste. Attendi almeno un minuto prima di riprovare.',
        503: 'Verifica temporaneamente indisponibile. Riprendi lo stesso abbinamento.',
      };
      setMessage(error instanceof HttpError ? messages[error.status] ?? checkoutErrorMessage(error) : checkoutErrorMessage(error));
    }
    finally { setBusy(false); }
  }
  return <section className="border rounded p-4 my-4" aria-label="Autorizza Checkout">
    <p>Apri il Checkout e conserva questa scheda. Copia qui il codice di abbinamento mostrato dal Checkout.</p>
    <a className="underline" href={checkoutLink(orderId)} target="_blank" rel="noopener noreferrer">Apri Checkout sicuro</a>
    <label className="block mt-3">Codice di abbinamento<input className="border w-full" value={code} maxLength={32} onChange={e => { setCode(e.target.value.trim()); setPairing(null); setMessage(''); }} disabled={busy} /></label>
    <button type="button" disabled={busy} onClick={() => void run(false)}>Controlla abbinamento</button>
    {pairing && <div><p>Codice di controllo: <strong>{pairing.phrase}</strong></p><button type="button" disabled={busy || pairing.state === 'approved'} onClick={() => void run(true)}>I codici coincidono: autorizza questo Checkout</button></div>}
    {message && <p role="status">{message}</p>}
    <p className="text-xs">Nessun nuovo ordine viene creato. Se perdi entrambe le schede e i dati salvati, richiedi assistenza per un recupero verificato.</p>
  </section>;
}
