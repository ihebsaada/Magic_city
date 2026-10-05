import {useEffect,useState} from "react";
import {redirectToStoreCart} from "@/lib/storeNavigation";
export default function Cart() {
 const [error,setError] = useState(false);
 useEffect(() => { try { redirectToStoreCart(); } catch { setError(true); } }, []);
 return <main className="p-6"><p role={error ? "alert" : "status"}>{error ? "Store non configurato. Contatta l'assistenza. Nessun pagamento avviato." : "Ritorno al carrello Store..."}</p></main>;
}
