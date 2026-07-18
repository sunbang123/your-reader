"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export function PwaInstaller() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }

    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as NavigatorWithStandalone).standalone === true;
    if (standalone) return;

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setShowIosHint(false);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setShowIosHint(false);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isSafari = /safari/i.test(window.navigator.userAgent) &&
      !/crios|fxios|edgios/i.test(window.navigator.userAgent);
    setShowIosHint(isIos && isSafari);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (installPrompt) {
    return (
      <button className="pwa-install" type="button" onClick={() => void install()}>
        <span aria-hidden="true">↓</span>
        앱으로 설치
      </button>
    );
  }

  if (showIosHint) {
    return (
      <aside className="pwa-ios-hint" aria-label="앱 설치 안내">
        <span>공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요.</span>
        <button type="button" onClick={() => setShowIosHint(false)} aria-label="설치 안내 닫기">×</button>
      </aside>
    );
  }

  return null;
}
