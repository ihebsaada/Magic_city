import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Header } from './Header';
import { Footer } from './Footer';
import { startPaidOrderCheck } from '@/lib/paidOrderCheck';
import { useCart } from '@/contexts/CartContext';
import { MobileBottomNav } from './MobileBottomNav';
import { ScrollProgress } from '../ScrollProgress';
export const Layout = () => {
  const { clearCart } = useCart();
  const [accessRequired, setAccessRequired] = useState(false);
  useEffect(() => {
    const currentOrderId = () => {
      try { return localStorage.getItem('lastOrderId'); } catch { return null; }
    };
    const lastOrderId = currentOrderId();
    if (!lastOrderId) return;
    return startPaidOrderCheck({ orderId: lastOrderId, currentOrderId, events: window,
      onAccessRequired: () => setAccessRequired(true),
      onPaid: () => {
        clearCart();
        try { localStorage.removeItem('lastOrderId'); } catch { /* Cart is already cleared. */ }
      },
    });
  }, [clearCart]);
  return (
    <div className="relative flex min-h-screen flex-col">
      <TopBar /><Header /><ScrollProgress />
      <main className="flex-1 pb-16 md:pb-0">
        {accessRequired && <p role="alert" className="container py-3 text-sm">Impossibile verificare il pagamento senza un accesso valido. Il carrello è conservato. Richiedi un recupero verificato all'assistenza prima di creare un nuovo ordine.</p>}
        <Outlet />
      </main>
      <Footer /><MobileBottomNav />
    </div>
  );
};
