// // src/components/layout/Layout.tsx
// import { useEffect } from "react";
// import { Outlet } from "react-router-dom";
// import { TopBar } from "./TopBar";
// import { Header } from "./Header";
// import { Footer } from "./Footer";
// import { apiGet } from "@/services/api";
// import { useCart } from "@/contexts/CartContext";
// import { MobileBottomNav } from "./MobileBottomNav";
// import { ScrollProgress } from "../ScrollProgress";
// import { useIsFetching, useIsMutating } from "@tanstack/react-query";
// import { LoadingScreen } from "@/components/LoadingScreen";
// import { useLoading } from "@/contexts/LoadingContext"; // 👈 IMPORTANT

// type OrderMinimal = {
//   id: string;
//   total: number;
//   currency: string;
//   status: string;
//   paymentStatus: string;
//   createdAt: string;
// };

// export const Layout = () => {
//   const { clearCart } = useCart();

//   // React Query global activity
//   const isFetching = useIsFetching();
//   const isMutating = useIsMutating();
//   const queryLoading = isFetching > 0 || isMutating > 0;

//   // 🔹 Loading manuel via contexte
//   const { isLoading: manualLoading } = useLoading();

//   // 🔹 Loader global = React Query OU manuel
//   const isLoadingGlobal = queryLoading || manualLoading;

//   useEffect(() => {
//     const lastOrderId = localStorage.getItem("lastOrderId");
//     if (!lastOrderId) return;

//     (async () => {
//       try {
//         const order = await apiGet<OrderMinimal>(`/orders/${lastOrderId}/min`);

//         if (order.paymentStatus === "PAID") {
//           clearCart();
//           localStorage.removeItem("lastOrderId");
//         }
//       } catch (e) {
//         console.error("Error while checking lastOrderId:", e);
//       }
//     })();
//   }, [clearCart]);

//   return (
//     <div className="flex min-h-screen flex-col">
//       <TopBar />
//       <Header />
//       <ScrollProgress />

//       {/* 🧊 CONTENT ONLY: header/footer are not covered */}
//       <main className="relative flex-1 pb-16 md:pb-0">
//         {isLoadingGlobal && (
//           <div className="absolute inset-0 z-30 flex justify-center pt-32 bg-background/80">
//             <LoadingScreen />
//           </div>
//         )}

//         <Outlet />
//       </main>

//       <Footer />
//       <MobileBottomNav />
//     </div>
//   );
// };
// src/components/layout/Layout.tsx
// src/components/layout/Layout.tsx
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { TopBar } from "./TopBar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { apiGet } from "@/services/api";
import { useCart } from "@/contexts/CartContext";
import { MobileBottomNav } from "./MobileBottomNav";
import { ScrollProgress } from "../ScrollProgress";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useLoading } from "@/contexts/LoadingContext";

type OrderMinimal = {
  id: string;
  total: number;
  currency: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
};

export const Layout = () => {
  const { clearCart } = useCart();
  const location = useLocation();

  // 🔹 Loader local pour le changement de route
  const [routeLoading, setRouteLoading] = useState(false);

  // React Query global activity
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const queryLoading = isFetching > 0 || isMutating > 0;

  // Loading manuel via contexte (si tu utilises withLoading plus tard)
  const { isLoading: manualLoading } = useLoading();

  // 🌍 Loader global = React Query OU manuel OU navigation
  const isLoadingGlobal = queryLoading || manualLoading || routeLoading;

  // ✅ Loader à chaque changement de route (même sans fetch)
  useEffect(() => {
    setRouteLoading(true);

    const timeout = setTimeout(() => {
      setRouteLoading(false);
    }, 400);

    return () => {
      clearTimeout(timeout);
    };
  }, [location.pathname]);

  // ✅ Vérification du dernier order pour vider le panier
  useEffect(() => {
    const lastOrderId = localStorage.getItem("lastOrderId");
    if (!lastOrderId) return;

    (async () => {
      try {
        const order = await apiGet<OrderMinimal>(`/orders/${lastOrderId}/min`);

        if (order.paymentStatus === "PAID") {
          clearCart();
          localStorage.removeItem("lastOrderId");
        }
      } catch (e) {
        console.error("Error while checking lastOrderId:", e);
      }
    })();
  }, [clearCart]);

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* 🔥 OVERLAY GLOBAL FIXÉ SUR LE VIEWPORT (ne touche pas la mise en page) */}
      {isLoadingGlobal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <LoadingScreen />
        </div>
      )}

      <TopBar />
      <Header />
      <ScrollProgress />

      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  );
};
