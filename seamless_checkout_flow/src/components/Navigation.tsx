import {Link} from "react-router-dom";
import StoreLink from "@/components/StoreLink";
export default function Navigation() {
 return <header className="border-b border-border bg-background"><nav className="container mx-auto p-4 flex items-center justify-between gap-4">
 <Link to="/" className="font-semibold">Checkout sicuro</Link>
 <StoreLink path="/">Store</StoreLink><StoreLink>Carrello Store</StoreLink>
 </nav></header>;
}
