import { HeroSection } from "@/components/home/HeroSection";
import { CollectionsSection } from "@/components/home/CollectionsSection";
import { BestSellersSection } from "@/components/home/BestSellersSection";
import { ServicesSection } from "@/components/home/ServicesSection";
import { HorizontalMediaMarquee } from "@/components/home/HorizontalMediaMarquee";
import { VerticalGallerySection } from "@/components/home/VerticalGallerySection";
import { ScrollingPromoBar } from "@/components/home/ScrollingPromoBar";
import { SatisfiedClientsSection } from "@/components/home/SatisfiedClientsSection";
import { PromoDiscountSection } from "@/components/home/PromoDiscountSection";

const Home = () => {
  const marqueeItems = [
    {
      href: "https://www.instagram.com/p/DHDaHSWTcD0/",
      src: "https://magiccitydrip.com/cdn/shop/videos/c/vp/57b66d033dbf4568adb2c4867e92c49e/57b66d033dbf4568adb2c4867e92c49e.HD-1080p-2.5Mbps-60212089.mp4?v=0",
      alt: "Vidéo Instagram 1",
    },
    {
      href: "https://www.instagram.com/p/DHDaRblTyTw/",
      src: "https://magiccitydrip.com/cdn/shop/videos/c/vp/ca81c1c5ad7f49e994e9734e57025b85/ca81c1c5ad7f49e994e9734e57025b85.HD-1080p-2.5Mbps-60212069.mp4?v=0",
      alt: "Vidéo Instagram 2",
    },
    {
      href: "https://www.instagram.com/p/DHDaL8bzvre/",
      src: "https://magiccitydrip.com/cdn/shop/videos/c/vp/b0489ef997864f0f8994fe266ae8f0f4/b0489ef997864f0f8994fe266ae8f0f4.HD-1080p-2.5Mbps-60212073.mp4?v=0",
      alt: "Vidéo Instagram 3",
    },
    {
      href: "https://www.instagram.com/p/DHDaKABT5OZ/",
      src: "https://magiccitydrip.com/cdn/shop/videos/c/vp/2ef80788f2594d8c838de3b3ca3df900/2ef80788f2594d8c838de3b3ca3df900.SD-480p-0.9Mbps-60212067.mp4?v=0",
      alt: "Vidéo Instagram 4",
    },
    {
      href: "https://www.instagram.com/p/DHDaPUbTZa5/",
      src: "https://magiccitydrip.com/cdn/shop/videos/c/vp/5050d471a37649a4b233824eb41a8f62/5050d471a37649a4b233824eb41a8f62.SD-480p-0.9Mbps-60212072.mp4?v=0",
      alt: "Vidéo Instagram 5",
    },
    {
      href: "https://www.instagram.com/p/DHDaVzOzpoY/",
      src: "https://magiccitydrip.com/cdn/shop/videos/c/vp/b0489ef997864f0f8994fe266ae8f0f4/b0489ef997864f0f8994fe266ae8f0f4.HD-1080p-2.5Mbps-60212073.mp4?v=0",
      alt: "Vidéo Instagram 6",
    },
  ];

  return (
    <div className="min-h-screen">
      <HeroSection />
      <PromoDiscountSection />
      <CollectionsSection />
      <BestSellersSection />
      <SatisfiedClientsSection />
      <VerticalGallerySection />
      <ScrollingPromoBar />
      <HorizontalMediaMarquee items={marqueeItems} />
      <ServicesSection />
    </div>
  );
};

export default Home;
