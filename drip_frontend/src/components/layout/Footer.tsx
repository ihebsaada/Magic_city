import { Link } from "react-router-dom";
import { Instagram, Facebook } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Footer = () => {
  return (
    <footer className="border-t bg-muted/30">
      {/* Newsletter */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="mb-2 font-serif text-2xl font-bold">
              Iscriviti alla Newsletter
            </h3>
            <p className="mb-6 text-sm text-muted-foreground">
              Ricevi in anteprima notizie su nuovi arrivi, offerte esclusive e molto altro
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="La tua email"
                className="bg-background"
              />
              <Button variant="default" className="bg-primary hover:bg-primary/90">
                Iscriviti
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div>
            <h4 className="mb-4 font-serif text-xl font-bold">
              Magic City Drip
            </h4>
            <p className="text-sm text-muted-foreground">
              Le migliori sneakers luxury italiane e internazionali. Qualità, stile e autenticità garantita.
            </p>
            <div className="mt-4 flex space-x-3">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-accent"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-accent"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h5 className="mb-4 font-medium">Shop</h5>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/catalog" className="text-muted-foreground transition-colors hover:text-foreground">
                  Catalogo
                </Link>
              </li>
              <li>
                <Link to="/collections" className="text-muted-foreground transition-colors hover:text-foreground">
                  Collezioni
                </Link>
              </li>
              <li>
                <Link to="/catalog?filter=new" className="text-muted-foreground transition-colors hover:text-foreground">
                  Nuovi Arrivi
                </Link>
              </li>
              <li>
                <Link to="/catalog?filter=sale" className="text-muted-foreground transition-colors hover:text-foreground">
                  Saldi
                </Link>
              </li>
            </ul>
          </div>

          {/* Assistenza */}
          <div>
            <h5 className="mb-4 font-medium">Assistenza</h5>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/contact" className="text-muted-foreground transition-colors hover:text-foreground">
                  Contatti
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-muted-foreground transition-colors hover:text-foreground">
                  FAQ
                </Link>
              </li>
              <li>
                <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                  Spedizioni
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                  Resi e Cambi
                </a>
              </li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h5 className="mb-4 font-medium">Informazioni</h5>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Milano, Italia</li>
              <li>info@magiccitydrip.com</li>
              <li>+39 02 1234 5678</li>
              <li className="pt-2">Lun-Ven: 9:00 - 18:00</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
            <p>© 2025 Magic City Drip. Tutti i diritti riservati.</p>
            <div className="flex gap-6">
              <a href="#" className="transition-colors hover:text-foreground">
                Privacy Policy
              </a>
              <a href="#" className="transition-colors hover:text-foreground">
                Termini & Condizioni
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
