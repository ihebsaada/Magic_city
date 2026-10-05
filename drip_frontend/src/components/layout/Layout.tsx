import {mayClearPaidCart} from '@/lib/paidCart';
import { LoadingScreen } from "@/components/LoadingScreen";
import { useHistoricalLoading } from "@/hooks/useHistoricalLoading";
import { useEffect, useState, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Header } from './Header';
import { Footer } from './Footer';
import { startPaidOrderCheck } from '@/lib/paidOrderCheck';
import { useCart } from '@/contexts/CartContext';
import { MobileBottomNav } from './MobileBottomNav';
import { ScrollProgress } from '../ScrollProgress';
export const Layout = () => {
  const { clearCart, items } = useCart();
  const cart=useRef(items);cart.current=items;
  const loading=useHistoricalLoading();
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
        if(mayClearPaidCart(lastOrderId,cart.current))clearCart();
        try { localStorage.removeItem('lastOrderId'); } catch { /* Cart is already cleared. */ }
      },
    });
  }, [clearCart]);
  return (
    <div className="relative flex min-h-screen flex-col">
      {loading && <div role="status" aria-label="Caricamento" className="fixed inset-0 z-50 flex items-center justify-center bg-background/80"><LoadingScreen /></div>}
      <TopBar /><Header /><ScrollProgress />
      <main className="flex-1 pb-16 md:pb-0">
        {accessRequired && <p role="alert" className="container py-3 text-sm">Impossibile verificare il pagamento senza un accesso valido. Il carrello è conservato. Contatta l'assistenza prima di creare un nuovo ordine.</p>}
        <Outlet />
      </main>
      <Footer /><MobileBottomNav />
    </div>
  );
};
