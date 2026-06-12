import { useEffect, useRef, useState } from "react";
import { Coffee, Info } from "lucide-react";

const KOFI_USERNAME = "FIBeGS";

export const FloatingDonateButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const scrollYRef = useRef(0);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("open-donate", handler);
    return () => window.removeEventListener("open-donate", handler);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    scrollYRef.current = window.scrollY;

    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const originalBodyLeft = document.body.style.left;
    const originalBodyRight = document.body.style.right;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollYRef.current}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      document.body.style.left = originalBodyLeft;
      document.body.style.right = originalBodyRight;
      window.scrollTo(0, scrollYRef.current);
    };
  }, [isOpen]);

  const open = () => {
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={open}
        className="hidden items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg shadow-primary/30 hover:scale-105 hover:shadow-xl hover:shadow-primary/40 transition-all duration-300 font-semibold text-sm group"
        aria-label="Supporta il progetto"
      >
        <Coffee size={18} className="group-hover:fill-primary-foreground transition-all duration-300" />
        <span className="hidden sm:inline">Supportaci</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overscroll-none"
          onClick={close}
        >
          <div
            className="relative w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]"
            style={{ overflow: "hidden", background: "#f9f9f9" }}
            onClick={(e) => e.stopPropagation()}
          >

            {/* Banner promemoria username */}
            <div
              className="flex items-center gap-2 px-4 py-3 text-xs"
              style={{ background: "#f9f9f9", borderBottom: "1px solid #e5e5e5", paddingTop: "30px" }}
            >
              <Info size={16} className="shrink-0 text-gray-500" />
              <span className="text-gray-600">
                Inserisci il tuo <strong className="text-gray-800">username FIBeGS</strong> nel campo "Display name" o nel messaggio per essere riconosciuto!
              </span>
            </div>

            <iframe
              id="kofiframe"
              src={`https://ko-fi.com/${KOFI_USERNAME}/?hidefeed=true&widget=true&embed=true&preview=true`}
              className="w-full border-0"
              style={{
                height: "580px",
                background: "#f9f9f9",
                flexShrink: 0,
              }}
              title="Supportaci su Ko-fi"
            />

            <button
              onClick={close}
              className="w-full py-3 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </>
  );
};
