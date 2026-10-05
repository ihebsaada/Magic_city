import {storeUrl} from "@/lib/storeNavigation";
export default function StoreLink({path = "/cart", children}: {path?: "/" | "/cart"; children: React.ReactNode}) {
 let href: string;
 try { href = storeUrl(path); } catch { return <span role="alert">Store non configurato. Contatta l'assistenza.</span>; }
 return <a className="underline" href={href} rel="noreferrer">{children}</a>;
}
