import { Link } from "react-router-dom";
import { Instagram, Facebook, MapPin, Phone, Mail } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Footer = () => {
  return (
    <footer className="border-t bg-background pb-20 md:pb-10">
      {/* ─────────────────────
          BLOC PRINCIPAL (infos + newsletter)
      ────────────────────── */}
      <div className="border-b">
        <div className="container mx-auto grid grid-cols-1 gap-10 px-6 py-10 md:grid-cols-2 md:py-14">
          {/* COLONNE GAUCHE : infos boutique */}
          <div className="space-y-4 text-xs text-muted-foreground md:text-[13px]">
            <p>
              Proponiamo solo modelli in cui crediamo dal punto di vista etico
              ed estetico: pezzi 1:1, fatti per durare.{" "}
              <button
                type="button"
                className="inline-flex text-[11px] font-semibold underline underline-offset-4 hover:text-foreground"
              >
                Scopri di più
              </button>
            </p>

            <div className="space-y-2 pt-2">
              <div className="flex items-start gap-3">
                <MapPin className="mt-[2px] h-4 w-4" />
                <span>Viale della Speranza 13 Milano MI 20146</span>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-[2px] h-4 w-4" />
                <span>+1 (973) 435-3638</span>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="mt-[2px] h-4 w-4" />
                <span>info@magiccitydrip.com</span>
              </div>
            </div>
          </div>

          {/* COLONNE DROITE : newsletter style screenshot */}
          <div className="text-xs md:text-[13px]">
            <h3 className="text-sm font-semibold text-foreground md:text-base">
              Iscriviti alla Newsletter
            </h3>

            <p className="mt-2 text-[11px] text-muted-foreground md:text-xs">
              Resta aggiornato sui nuovi arrivi, offerte esclusive e sconti
              riservati.
            </p>

            <form className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Input
                type="email"
                placeholder="Inserisci il tuo indirizzo e-mail per iscriverti"
                className="h-9 flex-1 rounded-full border bg-background px-4 text-[11px] md:h-10 md:text-xs"
                required
              />
              <Button
                type="submit"
                className="h-9 whitespace-nowrap rounded-full px-6 text-[11px] font-semibold md:h-10 md:text-xs"
              >
                Iscriviti
              </Button>
            </form>

            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground md:text-[11px]">
              Inserendo la tua e-mail accetti i termini e condizioni e
              l&apos;informativa sulla privacy.
            </p>

            {/* Réseaux sociaux en petits ronds */}
            <div className="mt-4 flex gap-3">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────
          BARRE DU BAS (pays + copyright + paiements)
      ────────────────────── */}
      <div className="bg-muted/40">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-6 py-4 text-[11px] text-muted-foreground md:flex-row md:text-xs">
          {/* Pays / monnaie */}
          <div className="flex items-center gap-2">
            <span className="text-base">🇮🇹</span>
            <span>Italia (EUR €)</span>
          </div>

          <p className="text-center">
            © 2025 Magic City Drip store. All rights reserved.
          </p>

          {/* Icônes paiement */}
          {/* Icônes paiement */}
          <div className="flex items-center gap-2">
            <img
              src="/payment/PayPal.png"
              alt="PayPal"
              className="h-6 w-auto rounded bg-white px-1 py-0.5 shadow-sm"
            />
            <img
              src="/payment/Mastercard.png"
              alt="Mastercard"
              className="h-6 w-auto rounded bg-white px-1 py-0.5 shadow-sm"
            />
            <img
              src="/payment/visa.png"
              alt="Visa"
              className="h-6 w-auto rounded bg-white px-1 py-0.5 shadow-sm"
            />
            <img
              src="/payment/amex.webp"
              alt="Amex"
              className="h-6 w-auto rounded bg-white px-1 py-0.5 shadow-sm"
            />
            <img
              src="/payment/applepay.png"
              alt="Apple Pay"
              className="h-6 w-auto rounded bg-white px-1 py-0.5 shadow-sm"
            />
          </div>
        </div>
      </div>
    </footer>
  );
};
