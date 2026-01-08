import React from "react";

interface MediaItem {
  src: string;
  alt: string;
  href?: string;
}

interface HorizontalMediaMarqueeProps {
  title?: string;
  subtitle?: string;
  items: MediaItem[];
}

const isVideoUrl = (src: string): boolean => {
  try {
    const url = new URL(src, window.location.origin);
    const path = url.pathname.toLowerCase();
    return (
      path.endsWith(".mp4") || path.endsWith(".webm") || path.endsWith(".mov")
    );
  } catch {
    const lower = src.toLowerCase();
    return (
      lower.includes(".mp4") ||
      lower.includes(".webm") ||
      lower.includes(".mov")
    );
  }
};

export const HorizontalMediaMarquee: React.FC<HorizontalMediaMarqueeProps> = ({
  title = "@magiccity.drip",
  subtitle = "Lasciati ispirare e lasciati ispirare, da una moda unica all’altra.",
  items,
}) => {
  const loopItems = [...items, ...items];

  return (
    <section className="w-full bg-white py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 text-sm md:text-base text-neutral-500">
              {subtitle}
            </p>
          )}
        </div>

        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent z-10" />

          <div className="marquee-horizontal flex gap-4 md:gap-6">
            {loopItems.map((item, index) => {
              const isVideo = isVideoUrl(item.src);

              const mediaNode = isVideo ? (
                <video
                  src={item.src}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img
                  src={item.src}
                  alt={item.alt}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              );

              return (
                <div
                  key={`${item.src}-${index}`}
                  className="flex-shrink-0 w-56 h-72 md:w-64 md:h-80 rounded-2xl overflow-hidden bg-neutral-100 shadow-[0_14px_40px_rgba(0,0,0,0.12)]"
                >
                  {item.href ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={item.alt}
                    >
                      {mediaNode}
                    </a>
                  ) : (
                    mediaNode
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
