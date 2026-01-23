import React from "react";

type GalleryItem = {
  src: string;
  alt?: string;
};

const SHOPIFY_MEDIA_BASE = "https://uc9d1w-mj.myshopify.com";

const leftColumnItems: GalleryItem[] = [
  {
    src: `${SHOPIFY_MEDIA_BASE}/cdn/shop/files/IMG_6519.jpg?v=1760898157&width=1179`,
    alt: "Magic City Drip gallery 1",
  },
  {
    src: `${SHOPIFY_MEDIA_BASE}/cdn/shop/files/IMG_6523.jpg?v=1760898157&width=1179`,
    alt: "Magic City Drip gallery 2",
  },
  {
    src: `${SHOPIFY_MEDIA_BASE}/cdn/shop/files/IMG_6528.jpg?v=1760898156&width=1179`,
    alt: "Magic City Drip gallery 3",
  },
  {
    src: `${SHOPIFY_MEDIA_BASE}/cdn/shop/files/IMG_6527.jpg?v=1760898156&width=1179`,
    alt: "Magic City Drip gallery 4",
  },
];

const rightColumnItems: GalleryItem[] = [
  {
    src: `${SHOPIFY_MEDIA_BASE}/cdn/shop/files/IMG_6525.jpg?v=1760898155&width=1179`,
    alt: "Magic City Drip gallery 5",
  },
  {
    src: `${SHOPIFY_MEDIA_BASE}/cdn/shop/files/IMG_6520.jpg?v=1760898156&width=1179`,
    alt: "Magic City Drip gallery 6",
  },
  {
    src: `${SHOPIFY_MEDIA_BASE}/cdn/shop/files/IMG_6526.jpg?v=1760898154&width=1179`,
    alt: "Magic City Drip gallery 7",
  },
  {
    src: `${SHOPIFY_MEDIA_BASE}/cdn/shop/files/IMG_6524.jpg?v=1760898154&width=1179`,
    alt: "Magic City Drip gallery 8",
  },
];

interface ColumnProps {
  items: GalleryItem[];
  direction: "up" | "down";
}

const VerticalColumn: React.FC<ColumnProps> = ({ items, direction }) => {
  // on duplique pour un défilement infini fluide
  const loopItems = [...items, ...items];

  return (
    <div className="h-[360px] md:h-[800px] overflow-hidden">
      <div
        className={`flex flex-col gap-4 ${
          direction === "up" ? "vertical-marquee-up" : "vertical-marquee-down"
        }`}
      >
        {loopItems.map((item, index) => (
          <div
            key={`${item.src}-${index}`}
            className="overflow-hidden rounded-2xl bg-neutral-100 shadow-[0_18px_45px_rgba(0,0,0,0.20)]"
          >
            <img
              src={item.src}
              alt={item.alt ?? "Magic City Drip gallery image"}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export const VerticalGallerySection: React.FC = () => {
  return (
    <section className="w-full bg-background py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
          <VerticalColumn items={leftColumnItems} direction="up" />
          <VerticalColumn items={rightColumnItems} direction="down" />
        </div>
      </div>
    </section>
  );
};
