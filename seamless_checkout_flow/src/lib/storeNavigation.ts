/** Build-time Store origin only; no browser state is used as configuration. */
export function storeUrl(path: "/" | "/cart", configured = import.meta.env.VITE_STORE_ORIGIN): string {
 if (!configured || configured.trim() !== configured) throw new Error("INVALID_STORE_ORIGIN");
 const o = new URL(configured);
 if ((configured !== o.origin && configured !== o.origin + "/") || o.username || o.password || o.search || o.hash || o.pathname !== "/" ||
     (o.protocol !== "https:" && !(o.protocol === "http:" && ["127.0.0.1", "localhost"].includes(o.hostname))) ||
     (path !== "/" && path !== "/cart")) throw new Error("INVALID_STORE_ORIGIN");
 return o.origin + path;
}
export function redirectToStoreCart(): void {
 window.location.replace(storeUrl("/cart"));
}
