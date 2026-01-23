import React from "react";

const MESSAGES = [
  "20% di sconto per ordini oltre 390€",
  "Spedizione gratuita per ordini a partire da 99,90€",
];

export const ScrollingPromoBar: React.FC = () => {
  return (
    <div className="w-full bg-white text-black text-sm md:text-[15px] border-y">
      <div className="relative overflow-hidden py-4">
        {/* gradient gauche */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent" />
        {/* gradient droite */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent" />

        <div className="group">
          {/* Élément qui bouge */}
          <div className="marquee-horizontal flex w-max whitespace-nowrap gap-24 px-6 group-hover:[animation-play-state:paused]">
            {Array.from({ length: 4 }).map((_, repeatIndex) =>
              MESSAGES.map((message, index) => (
                <div
                  key={`${repeatIndex}-${index}`}
                  className="flex items-center gap-8 text-neutral-600"
                >
                  <span>{message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
