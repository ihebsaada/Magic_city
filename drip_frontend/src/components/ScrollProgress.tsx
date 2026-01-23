import { useEffect, useRef } from "react";

export const ScrollProgress = () => {
  const barRef = useRef<HTMLDivElement | null>(null);
  const circleRef = useRef<SVGCircleElement | null>(null);
  const scrollToTopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return; // sécurité SSR éventuelle

    const CIRCUMFERENCE = 2 * Math.PI * 45; // r = 45 -> ~283

    const update = () => {
      const doc = document.documentElement;
      const totalHeight = doc.scrollHeight - window.innerHeight;

      if (totalHeight <= 0) return;

      const progressRatio = window.scrollY / totalHeight;

      // 🔹 barre horizontale
      if (barRef.current) {
        barRef.current.style.width = `${progressRatio * 100}%`;
      }

      // 🔹 cercle
      if (circleRef.current) {
        circleRef.current.style.strokeDasharray = `${CIRCUMFERENCE}`;
        circleRef.current.style.strokeDashoffset = String(
          CIRCUMFERENCE * (1 - progressRatio)
        );
      }

      // 🔹 apparition du bouton scroll-to-top tout en bas
      if (scrollToTopRef.current) {
        const isAtBottom =
          window.innerHeight + window.scrollY >= doc.scrollHeight - 10;
        scrollToTopRef.current.style.opacity = isAtBottom ? "1" : "0";
      }
    };

    const handleClickScrollTop = () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // listeners
    window.addEventListener("scroll", update);
    window.addEventListener("resize", update);

    // click sur le bouton
    scrollToTopRef.current?.addEventListener("click", handleClickScrollTop);

    // premier calcul
    update();

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      scrollToTopRef.current?.removeEventListener(
        "click",
        handleClickScrollTop
      );
    };
  }, []);

  return (
    <>
      {/* Progress bar top */}
      <div className="progress-bar-container">
        <div className="progress-bar" ref={barRef} />
      </div>

      {/* Progress circle + scroll-to-top */}
      <div className="progress-circle-container">
        <svg className="progress-circle" viewBox="0 0 100 100">
          <circle
            className="progress-background"
            cx="50"
            cy="50"
            r="45"
          ></circle>
          <circle
            className="progress-circle-bar"
            cx="50"
            cy="50"
            r="45"
            ref={circleRef}
          ></circle>
        </svg>

        <div className="scroll-to-top" ref={scrollToTopRef}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </div>
      </div>
    </>
  );
};
