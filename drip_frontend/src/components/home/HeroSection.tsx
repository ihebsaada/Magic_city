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
      "https://cdn.shopify.com/s/files/1/0958/6737/1837/files/Logo_Wemaad.png?v=1760804024",
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
    <section className="relative overflow-hidden bg-black text-white md:h-[85vh] min-h-[520px]">
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

            {/* CONTENT */}
            <div className="relative z-10 flex h-full items-center lg:items-end">
              <div
                className="
                      container mx-auto
      px-4 md:pl-14 lg:pl-20
      flex flex-col justify-end
      h-full
      pb-14 sm:pb-18
      md:pb-24 lg:pb-28 xl:pb-32 
                    "
              >
                <div
                  className={`max-w-[600px] space-y-4 md:space-y-6 transform transition-all duration-700
                    ${
                      isActive
                        ? "translate-y-0 opacity-100"
                        : "translate-y-6 opacity-0"
                    }`}
                >
                  {/* EYEBROW */}
                  <p className="mb-1 text-[10px] sm:text-xs font-semibold tracking-[0.25em] text-white/80">
                    {slide.eyebrow}
                  </p>

                  {/* TITLE */}
                  <h1
                    className="
                      whitespace-pre-line
                      font-serif font-bold leading-tight
                      text-[20px]
                      sm:text-[24px]
                      md:text-[32px]
                      lg:text-[40px]
                      max-w-[580px]
                    "
                  >
                    {slide.title}
                  </h1>

                  {/* SUBTITLE */}
                  <p className="max-w-[500px] text-[13px] sm:text-[15px] text-white/85 mt-2">
                    {slide.subtitle}
                  </p>

                  {/* CTA */}
                  <div className="mt-5 flex flex-wrap gap-4">
                    <Button
                      asChild
                      size="lg"
                      className="rounded-full bg-white px-8 py-6 text-[16px] sm:text-[17px] text-black hover:bg-white/90"
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

      {/* ARROWS */}
      <button
        type="button"
        onClick={goPrev}
        className="absolute left-3 md:left-6 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-md hover:bg-white"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={goNext}
        className="absolute right-3 md:right-6 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-md hover:bg-white"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* BULLETS */}
      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 space-x-3 md:bottom-8">
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

      {/* anti-flash */}
      <div className="invisible relative block pb-[70vh] md:pb-0" />
    </section>
  );
};
