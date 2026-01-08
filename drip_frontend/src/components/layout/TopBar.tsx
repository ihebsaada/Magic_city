import { Instagram } from "lucide-react";

const promoText =
  "Spedizione gratuita a partire da 99,90 € · Sconto -20% sopra 390 €";

export const TopBar = () => {
  return (
    <div className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4">
        <div className="flex h-10 items-center justify-between text-xs md:text-sm">
          {/* Track animé */}
          <div className="flex-1 overflow-hidden">
            <div className="topbar-marquee flex items-center gap-10">
              <p className="topbar-track animate-marquee font-medium">
                <span>{promoText}</span>
                <span className="topbar-gap">{promoText}</span>
              </p>
            </div>
          </div>

          {/* Icône Instagram */}
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 flex items-center gap-2 transition-opacity hover:opacity-80"
            aria-label="Instagram"
          >
            <Instagram className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
};
