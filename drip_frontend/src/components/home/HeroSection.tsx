// import { Link } from "react-router-dom";
// import { Button } from "@/components/ui/button";
// import { ArrowRight } from "lucide-react";

// export const HeroSection = () => {
//   return (
//     <section className="relative h-[70vh] min-h-[500px] overflow-hidden bg-primary">
//       {/* Background Image */}
//       <div
//         className="absolute inset-0 bg-cover bg-center"
//         style={{
//           backgroundImage: "url('https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=1600&q=80')",
//         }}
//       >
//         <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/60 to-transparent" />
//       </div>

//       {/* Content */}
//       <div className="container relative mx-auto flex h-full items-center px-4">
//         <div className="max-w-2xl text-primary-foreground">
//           <h1 className="mb-4 font-serif text-5xl font-bold leading-tight md:text-6xl lg:text-7xl">
//             Look moderni per tutti i giorni
//           </h1>
//           <p className="mb-8 text-lg text-primary-foreground/90 md:text-xl">
//             Scopri la nostra selezione curata di sneakers luxury italiane e internazionali.
//             Stile, comfort e qualità senza compromessi.
//           </p>
//           <div className="flex flex-wrap gap-4">
//             <Button
//               asChild
//               size="lg"
//               className="bg-accent text-accent-foreground hover:bg-accent/90"
//             >
//               <Link to="/collections">
//                 Scopri le Collezioni
//                 <ArrowRight className="ml-2 h-5 w-5" />
//               </Link>
//             </Button>
//             <Button
//               asChild
//               size="lg"
//               variant="outline"
//               className="border-primary-foreground bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary"
//             >
//               <Link to="/catalog?filter=new">
//                 Nuovi Arrivi
//               </Link>
//             </Button>
//           </div>
//         </div>
//       </div>
//     </section>
//   );
// };
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type HeroSlide = {
  id: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaLink: string;
  imageUrl: string;
};

const slides: HeroSlide[] = [
  {
    id: 1,
    eyebrow: "ELEVATE YOUR STYLE",
    title: "Oltre 10.000 Prodotti\nin pronta consegna",
    subtitle:
      "Sandali, sneakers e streetwear di brand iconici, spediti velocemente in tutta Italia.",
    ctaLabel: "Scopri Di Più",
    ctaLink: "/catalog",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0958/6737/1837/files/Logo_Wemaad.png?v=1760804024", // à remplacer par l'image OFF-WHITE réelle
  },
  {
    id: 2,
    eyebrow: "LOOK MODERNI PER TUTTI I GIORNI",
    title: "Comfort ineguagliabile\nAspetto irriconoscibile",
    subtitle:
      "Scopri le nostre sneakers luxury: qualità premium, comfort estremo e dettagli che non passano inosservati.",
    ctaLabel: "Scopri Le Collezioni",
    ctaLink: "/collections",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0958/6737/1837/files/IMG_6509.jpg?v=1760804749",
  },
];

const SLIDE_INTERVAL = 4000;

export const HeroSection = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  // autoplay
  useEffect(() => {
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, SLIDE_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const goTo = (idx: number) =>
    setActiveIndex((idx + slides.length) % slides.length);

  const goNext = () => goTo(activeIndex + 1);
  const goPrev = () => goTo(activeIndex - 1);

  return (
    <section className="relative overflow-hidden bg-black text-white md:h-[80vh] min-h-[520px]">
      {/* SLIDES */}
      {slides.map((slide, index) => {
        const isActive = index === activeIndex;

        return (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${
              isActive ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {/* Background image */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('${slide.imageUrl}')` }}
            />
            {/* Overlay Shopify-like */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10 md:bg-gradient-to-r md:from-black/80 md:via-black/60 md:to-black/10" />

            {/* CONTENT (texte + CTA) */}
            <div className="relative z-10 flex h-full items-center">
              <div className="container mx-auto px-4 md:pl-12 lg:pl-20 pb-10 md:pb-16">
                {/* bloc qui fait l’animation drop-down */}
                <div
                  className={`max-w-[680px] space-y-4 md:space-y-6 transform transition-all duration-700
                    lg:mt-10 
                    ${
                      isActive
                        ? "translate-y-0 opacity-100"
                        : "translate-y-6 opacity-0"
                    }`}
                >
                  {/* EYEBROW */}
                  <p className="mb-2 text-xs font-semibold tracking-[0.25em] text-white/80 sm:text-sm">
                    {slide.eyebrow}
                  </p>

                  {/* TITLE (même taille que Shopify) */}
                  <h1
                    className="
                      whitespace-pre-line
                      font-serif
                      font-bold
                      leading-tight
                      text-[18px]
                     sm:text-[22px]
                      md:text-[28px]
                      lg:text-[34px]
                      max-w-[580px] "
                  >
                    {slide.title}
                  </h1>

                  {/* SUBTITLE */}
                  <p className="max-w-[500px] text-[13px] sm:text-[15px] text-white/85 mt-2">
                    {slide.subtitle}
                  </p>

                  {/* CTA */}
                  <div className="mt-4 flex flex-wrap gap-4">
                    <Button
                      asChild
                      size="lg"
                      className="rounded-full bg-white px-8 py-6 text-[17px] text-black hover:bg-white/90"
                    >
                      <Link to={slide.ctaLink}>
                        {slide.ctaLabel}
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* ARROWS < > */}
      <button
        type="button"
        onClick={goPrev}
        className="absolute left-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-md hover:bg-white"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={goNext}
        className="absolute right-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-md hover:bg-white"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* BULLETS en bas (cercle + point) */}
      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 space-x-3 md:bottom-6">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => goTo(index)}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-white/60 bg-black/30"
            >
              <span
                className={`h-2 w-2 rounded-full transition-colors ${
                  isActive ? "bg-white" : "bg-white/40"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* pour éviter flash au tout début sur certains navigateurs */}
      <div className="invisible relative block pb-[70vh] md:pb-0" />
    </section>
  );
};
