import React, { useRef } from "react";

type InstaFeedback = {
  id: number;
  image: string;
  customer: string;
  highlight: string;
  caption: string;
};

const FEEDBACKS: InstaFeedback[] = [
  {
    id: 1,
    image: "/feedback/feedback-1.jpeg",
    customer: "Cliente Instagram",
    highlight: "“Arrivate, spaccano 🔥”",
    caption:
      "Il cliente riceve le sue sneakers, conferma la consegna e ci lascia un feedback 5⭐: «Arrivate, spaccano». Solo da Magic City 🚀",
  },
  {
    id: 2,
    image: "/feedback/feedback-2.jpeg",
    customer: "Cliente Instagram",
    highlight: "“Sono arrivate, bellissime 😍”",
    caption:
      "Le sneakers arrivano, il cliente le trova bellissime e ci autorizza anche a condividere la sua recensione nelle stories.",
  },
  {
    id: 3,
    image: "/feedback/feedback-3.jpeg",
    customer: "Cliente Instagram",
    highlight: "Feedback 5⭐ su Instagram",
    caption:
      "Il cliente riceve la sua paia bianca, ci chiede solo di oscurare nome e foto profilo… già pronto per il prossimo ordine ❤️",
  },
  {
    id: 4,
    image: "/feedback/feedback-4.jpeg",
    customer: "Cliente Instagram",
    highlight: "“Arrivate, grazieee 🙏”",
    caption:
      "Dopo l’invio del tracking, il cliente conferma la consegna della sua paia Louis Vuitton e ci lascia un feedback 5⭐.",
  },
];

export const SatisfiedClientsSection: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = (direction: "prev" | "next") => {
    const container = scrollRef.current;
    if (!container) return;

    const amount = container.clientWidth; // scorriamo di una “pagina”
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
            Clienti soddisfatti:
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            Messaggi reali, clienti reali. Ecco alcuni feedback ricevuti
            direttamente su Instagram dopo la consegna delle loro paia.
          </p>
        </div>

        {/* Linea + pulsanti */}
        <div className="flex items-center justify-between gap-6 mb-6">
          <div className="flex-1 h-px bg-border" />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleScroll("prev")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-muted transition"
              aria-label="Diapositiva precedente"
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
              aria-label="Diapositiva successiva"
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

        {/* Slider scrollabile */}
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {/* nasconde visivamente la scrollbar webkit */}
          <style>{`
            [data-testimonials-scroll]::-webkit-scrollbar { display: none; }
          `}</style>

          {FEEDBACKS.map((item) => (
            <article
              key={item.id}
              className="snap-start min-w-[80%] md:min-w-[48%] lg:min-w-[46%] flex flex-col md:flex-row bg-white rounded-xl border shadow-sm overflow-hidden"
              data-testimonials-scroll
            >
              {/* Immagine Instagram: a sinistra su desktop, in alto su mobile */}
              <div className="w-full md:w-1/2 relative bg-black">
                <img
                  src={item.image}
                  alt={item.customer}
                  className="h-full w-full object-contain md:object-cover mx-auto"
                  loading="lazy"
                />
              </div>

              {/* Contenuto testuale */}
              <div className="flex-1 flex items-center">
                <div className="w-full px-5 md:px-7 py-6 md:py-7">
                  {/* Rating 5★ */}
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

                  {/* Nome + badge “Feedback da Instagram” */}
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className="font-semibold text-sm md:text-base">
                      {item.customer}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="inline-flex h-6 items-center rounded-full bg-muted px-3 text-[11px]">
                        Feedback da Instagram
                      </span>
                    </span>
                  </div>

                  {/* Highlight (frase corta) */}
                  <p className="text-sm md:text-[15px] font-medium mb-2">
                    {item.highlight}
                  </p>

                  {/* Caption dettagliata */}
                  <p className="text-sm md:text-[15px] text-muted-foreground">
                    {item.caption}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
