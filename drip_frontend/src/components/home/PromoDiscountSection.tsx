import { Instagram } from "lucide-react";

export const PromoDiscountSection = () => {
  const instagramUrl = "https://www.instagram.com/magiccitydrip_"; // adapte ton @
  const code = "MAGIC10";

  return (
    <div className="border-b border-border bg-emerald-900 text-emerald-50">
      <div className="container mx-auto px-4 py-2 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-xs md:text-sm text-center">
        <span className="uppercase tracking-[0.2em] text-[10px] md:text-[11px] opacity-80">
          Codice sconto esclusivo
        </span>

        <div className="inline-flex items-center gap-2">
          <span className="hidden md:inline">Usa il codice</span>
          <span className="font-mono text-xs md:text-sm font-semibold bg-emerald-50 text-emerald-900 px-3 py-1 rounded-full">
            {code}
          </span>
          <span className="hidden md:inline">
            nel carrello per ottenere il -10% sul tuo ordine.
          </span>
        </div>

        <a
          href={instagramUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:underline underline-offset-2 mt-1 md:mt-0"
        >
          <Instagram className="h-3 w-3" />
          <span>Scopri di più su Instagram</span>
        </a>
      </div>
    </div>
  );
};
