import Navigation from "@/components/Navigation";
import StoreLink from "@/components/StoreLink";
export default function Home() {
 return <div className="min-h-screen bg-background"><Navigation/><main className="max-w-xl mx-auto p-6 space-y-4">
 <h1 className="text-2xl font-bold">Checkout sicuro</h1>
 <p>Seleziona i prodotti e prepara il tuo ordine nello Store. Questo Checkout verifica soltanto l'ordine autorizzato.</p>
 <StoreLink path="/">Vai allo Store</StoreLink>
 </main></div>;
}
