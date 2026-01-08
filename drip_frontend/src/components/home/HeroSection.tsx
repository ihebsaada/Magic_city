import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const HeroSection = () => {
  return (
    <section className="relative h-[70vh] min-h-[500px] overflow-hidden bg-primary">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=1600&q=80')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="container relative mx-auto flex h-full items-center px-4">
        <div className="max-w-2xl text-primary-foreground">
          <h1 className="mb-4 font-serif text-5xl font-bold leading-tight md:text-6xl lg:text-7xl">
            Look moderni per tutti i giorni
          </h1>
          <p className="mb-8 text-lg text-primary-foreground/90 md:text-xl">
            Scopri la nostra selezione curata di sneakers luxury italiane e internazionali. 
            Stile, comfort e qualità senza compromessi.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button
              asChild
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Link to="/collections">
                Scopri le Collezioni
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary"
            >
              <Link to="/catalog?filter=new">
                Nuovi Arrivi
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
