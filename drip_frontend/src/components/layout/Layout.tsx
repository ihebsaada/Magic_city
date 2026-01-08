// import { Outlet } from "react-router-dom";
// import { TopBar } from "./TopBar";
// import { Header } from "./Header";
// import { Footer } from "./Footer";

// export const Layout = () => {
//   return (
//     <div className="flex min-h-screen flex-col">
//       <TopBar />
//       <Header />
//       <main className="flex-1">
//         <Outlet />
//       </main>
//       <Footer />
//     </div>
//   );
// };
import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { apiGet } from "@/services/api";
import { useCart } from "@/contexts/CartContext";

type OrderMinimal = {
  id: string;
  total: number;
  currency: string;
  status: string; // "PENDING" | "PROCESSING" | ...
  paymentStatus: string; // "PENDING" | "PAID" | "REFUNDED"
  createdAt: string;
};

export const Layout = () => {
  const { clearCart } = useCart();

  useEffect(() => {
    const lastOrderId = localStorage.getItem("lastOrderId");
    if (!lastOrderId) return;

    (async () => {
      try {
        const order = await apiGet<OrderMinimal>(`/orders/${lastOrderId}/min`);

        if (order.paymentStatus === "PAID") {
          // ✅ Paiement confirmé côté backend -> on vide le panier du SHOP
          clearCart();
          localStorage.removeItem("lastOrderId");
        }
        // Sinon (PENDING / etc.) on ne touche pas au panier
      } catch (e) {
        console.error("Error while checking lastOrderId:", e);
      }
    })();
  }, [clearCart]);

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
