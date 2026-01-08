import React, { useRef } from "react";

type TestimonialProduct = {
  name: string;
  price: string;
  image: string;
  href?: string;
};

type Testimonial = {
  id: number;
  customer: string;
  quote: string;
  product: TestimonialProduct;
};

const TESTIMONIALS: Testimonial[] = [
  {
    id: 1,
    customer: "Cameron S.",
    quote:
      "Produit parfait, il garde très chaud sans surchauffer. La taille est vraie, je ne pourrais pas être plus satisfait de l’achat... Merci ! 🤗",
    product: {
      name: "Basket Louis Vuitton",
      price: "184,90 € TVA incluse",
      image:
        "https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?auto=compress&cs=tinysrgb&w=600",
    },
  },
  {
    id: 2,
    customer: "Algistino F.",
    quote: "Un achat fantastique ! Je recommande vivement ! 😊",
    product: {
      name: "Baskets Hogan en cuir et tissu bleu foncé",
      price: "207,50 € TVA incluse",
      image:
        "https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=600",
    },
  },
  {
    id: 3,
    customer: "Carie-Gosée H.",
    quote:
      "Ils sont tellement mignons et confortables. La couleur est parfaite. Je les adore ! 😍",
    product: {
      name: "Balenciaga – Basket de sport",
      price: "199,90 € TVA incluse",
      image:
        "https://images.pexels.com/photos/1054777/pexels-photo-1054777.jpeg?auto=compress&cs=tinysrgb&w=600",
    },
  },
];

export const SatisfiedClientsSection: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = (direction: "prev" | "next") => {
    const container = scrollRef.current;
    if (!container) return;

    const amount = container.clientWidth; // on scrolle d’une “page”
    container.scrollBy({
      left: direction === "next" ? amount : -amount,
      behavior: "smooth",
    });
  };

  return (
    <section className="w-full bg-gradient-to-b from-background to-muted/40 py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-xl md:text-2xl font-serif tracking-tight mb-3">
            Clients satisfaits :
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            Les clients adorent nos produits, et nous nous efforçons toujours de
            plaire à tout le monde.
          </p>
        </div>

        {/* Actions + slider */}
        <div className="flex items-center justify-between gap-6 mb-6">
          <div className="flex-1 h-px bg-border" />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleScroll("prev")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-muted transition"
              aria-label="Diapositive précédente"
            >
              <svg
                width="10"
                height="16"
                viewBox="0 0 10 16"
                aria-hidden="true"
              >
                <path
                  d="M7.8 1L1.5 7.3c-.4.4-.4 1 0 1.4L7.8 15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => handleScroll("next")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-muted transition"
              aria-label="Diapositive suivante"
            >
              <svg
                width="10"
                height="16"
                viewBox="0 0 10 16"
                aria-hidden="true"
              >
                <path
                  d="M2.2 1l6.3 6.3c.4.4.4 1 0 1.4L2.2 15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Slider scrollable */}
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {/* cacher la scrollbar visuellement */}
          <style>{`
            [data-testimonials-scroll]::-webkit-scrollbar { display: none; }
          `}</style>

          {TESTIMONIALS.map((item) => (
            <article
              key={item.id}
              className="snap-start min-w-[80%] md:min-w-[48%] lg:min-w-[46%] flex bg-white rounded-xl border shadow-sm overflow-hidden"
              data-testimonials-scroll
            >
              {/* Image produit à gauche sur desktop */}
              <div className="hidden md:block w-1/3 relative overflow-hidden">
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>

              {/* Contenu */}
              <div className="flex-1 flex items-center">
                <div className="w-full px-5 md:px-7 py-6 md:py-7">
                  {/* Rating */}
                  <div className="mb-3">
                    <div className="relative inline-flex">
                      <div className="flex gap-1 text-muted-foreground/40">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <svg
                            key={i}
                            width="16"
                            height="16"
                            viewBox="0 0 20 20"
                            className="fill-current"
                          >
                            <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.9 5.06 16.7 6 11.9l-4-3.9 5.53-.8L10 1.5z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Nom + badge */}
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className="font-semibold text-sm md:text-base">
                      {item.customer}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <svg
                        width="12"
                        height="9"
                        viewBox="0 0 10 8"
                        aria-hidden="true"
                        className="text-emerald-500"
                      >
                        <path
                          d="M9.05.65L3.33 6.2.95 3.89A.8.8 0 0 0 .17 3.73.8.8 0 0 0 0 4.28c0 .14.06.27.17.36l2.77 2.7c.1.1.25.16.42.16.16 0 .31-.06.42-.16L9.83 1.4A.8.8 0 0 0 10 1.04a.8.8 0 0 0-.95-.39z"
                          fill="currentColor"
                        />
                      </svg>
                      <span>Acheteur vérifié</span>
                    </span>
                  </div>

                  {/* Quote */}
                  <p className="text-sm md:text-[15px] text-muted-foreground mb-5">
                    {item.quote}
                  </p>

                  {/* Produit */}
                  <div className="border-t pt-4 mt-3 flex items-center gap-4">
                    <div className="h-16 w-16 rounded-md overflow-hidden flex-shrink-0 md:hidden">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">
                        {item.product.name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {item.product.price}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
