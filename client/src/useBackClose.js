import { useEffect, useRef } from "react";

// Saat modal terbuka, tombol Back (HP/browser) menutup modal alih-alih keluar
// aplikasi: menambah satu entri history ketika terbuka; tekan Back memicu
// popstate -> onClose. Bila ditutup lewat tombol biasa, entri history dibuang.
// requestAnimationFrame dipakai agar aman dari double-invoke React StrictMode
// (setup+cleanup sinkron) yang bisa memicu popstate palsu.
export function useBackClose(isOpen, onClose) {
  const cbRef = useRef(onClose);
  cbRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    let pushed = false;
    const raf = requestAnimationFrame(() => {
      if (!active) return;
      window.history.pushState({ __modal: true }, "");
      pushed = true;
    });
    const onPop = () => {
      if (cbRef.current) cbRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      active = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("popstate", onPop);
      if (pushed && window.history.state && window.history.state.__modal) {
        window.history.back();
      }
    };
  }, [isOpen]);
}

