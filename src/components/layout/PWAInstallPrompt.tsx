import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Share } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;

    if (isStandalone) {
      return;
    }

    // 2. Check if dismissed recently (within 15 days)
    const dismissedAt = localStorage.getItem('dude_pwa_dismissed');
    if (dismissedAt) {
      const fifteenDaysInMs = 15 * 24 * 60 * 60 * 1000;
      const parsedTime = Number(dismissedAt);
      if (!isNaN(parsedTime) && (Date.now() - parsedTime < fifteenDaysInMs)) {
        return;
      }
    }

    // 3. Detect iOS agent
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIPhoneOrIPod = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIPhoneOrIPod);

    // Show prompt if on mobile or if deferred prompt fires
    if (isIPhoneOrIPod) {
      // iOS doesn't fire beforeinstallprompt, show prompt on delay if conditions are met
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // 4. Capture native beforeinstallprompt event for Android / Chrome / PC
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Wait a little bit to offer installation
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('dude_pwa_dismissed', String(Date.now()));
    setShowPrompt(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    // Show native prompt
    deferredPrompt.prompt();
    
    // Wait for the user response
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User responded to installation prompt: ${outcome}`);
    
    // Clear deferred event
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        transition={{ type: 'spring', damping: 25, stiffness: 180 }}
        className="fixed top-24 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[999] bg-[#161922] border border-[#6ee7a8]/20 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5),0_0_15px_rgba(110,231,168,0.05)] p-4 select-none"
      >
        <div className="flex gap-3 items-start">
          {/* Brand Mark or Icon */}
          <div className="w-9 h-9 rounded-xl bg-[#6ee7a8]/10 flex items-center justify-center shrink-0 border border-[#6ee7a8]/20">
            <Download className="w-4 h-4 text-[#6ee7a8]" />
          </div>

          {/* Info Text */}
          <div className="flex-1 space-y-1.5 min-w-0">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-[#6ee7a8]">DUDE nos seus Apps</h4>
            {isIOS ? (
              <p className="text-[10px] text-text-dim leading-relaxed">
                Para instalar a <strong className="text-text font-bold">DUDE</strong> no seu iPhone: toque em <strong className="text-text font-bold inline-flex items-center gap-0.5"><Share size={10} className="text-[#6ee7a8] inline" /> Compartilhar</strong> e depois em <strong className="text-text font-bold">"Adicionar à Tela de Início"</strong>.
              </p>
            ) : (
              <p className="text-[10px] text-text-dim leading-relaxed">
                Instale a <strong className="text-text font-bold">DUDE</strong> para acesso offline rápido, notificações instantâneas e visual nativo ultra imersivo.
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-1">
              {!isIOS && (
                <button
                  onClick={handleInstall}
                  className="px-3.5 py-2 bg-[#6ee7a8] text-black font-sans font-bold uppercase text-[9px] tracking-wider rounded-lg hover:brightness-105 active:scale-95 transition-all text-center cursor-pointer min-h-[28px]"
                >
                  Instalar App
                </button>
              )}
              <button
                onClick={handleDismiss}
                className="text-[9px] font-bold uppercase tracking-widest text-text-dim/60 hover:text-text duration-150 py-1 cursor-pointer"
              >
                Talvez mais tarde
              </button>
            </div>
          </div>

          {/* Dismiss Icon */}
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/5 rounded-lg text-text-dim/50 hover:text-text transition-colors duration-200 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
