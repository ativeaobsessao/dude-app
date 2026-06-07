import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Share, Smartphone, Monitor } from 'lucide-react';
import { usePWA } from '../../context/PWAContext';

export const PWAInstallPrompt: React.FC = () => {
  const {
    showInstallPrompt,
    installApp,
    dismissInstallPrompt,
    isIOS,
    isAndroid,
    isDesktop,
    showTutorialModal,
    setShowTutorialModal,
  } = usePWA();

  // Return nothing if neither the banner nor the tutorial is active
  if (!showInstallPrompt && !showTutorialModal) return null;

  return (
    <>
      {/* Top Ambient PWA Banner */}
      <AnimatePresence>
        {showInstallPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -80 }}
            transition={{ type: 'spring', damping: 22, stiffness: 150 }}
            className="fixed top-6 left-4 right-4 md:left-auto md:right-6 md:w-[420px] z-[9999] bg-[#0E131F]/95 border border-[#6ee7a8]/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_20px_rgba(110,231,168,0.1)] p-5 select-none backdrop-blur-md"
          >
            <div className="flex gap-4 items-start">
              {/* Icon Container */}
              <div className="w-10 h-10 rounded-xl bg-[#6ee7a8]/10 flex items-center justify-center shrink-0 border border-[#6ee7a8]/25 group">
                <Download className="w-5 h-5 text-[#6ee7a8] animate-bounce" />
              </div>

              {/* Inner Information block */}
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#6ee7a8]">
                    🚀 Instalar a DUDE
                  </h4>
                </div>
                <p className="text-[11px] text-text-dim leading-relaxed font-sans">
                  Acesse mais rápido, receba notificações e mantenha seu progresso sempre por perto.
                </p>

                {/* Micro Actions Block */}
                <div className="flex items-center gap-4 pt-1.5">
                  <button
                    onClick={installApp}
                    id="pwa-install-cta-btn"
                    className="px-4 py-2 bg-[#6ee7a8] hover:bg-[#52d693] text-black font-sans font-bold uppercase text-[9px] tracking-widest rounded-xl hover:brightness-105 active:scale-95 transition-all text-center cursor-pointer min-h-[32px] shadow-sm flex items-center gap-1.5"
                  >
                    Instalar
                  </button>
                  <button
                    onClick={dismissInstallPrompt}
                    id="pwa-dismiss-cta-btn"
                    className="text-[9px] font-bold uppercase tracking-widest text-text-dim/60 hover:text-text duration-150 py-1.5 cursor-pointer"
                  >
                    Agora não
                  </button>
                </div>
              </div>

              {/* Dismiss X icon */}
              <button
                onClick={dismissInstallPrompt}
                id="pwa-dismiss-x-btn"
                className="p-1 hover:bg-white/5 rounded-lg text-text-dim/50 hover:text-text transition-colors duration-200 cursor-pointer"
                title="Fechar"
              >
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tutorial Contextual Modal/Popup Fallback */}
      <AnimatePresence>
        {showTutorialModal && (
          <div
            onClick={() => setShowTutorialModal(false)}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md cursor-pointer"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-sm p-6 sm:p-8 rounded-[2rem] bg-[#0E131F] border border-white/5 shadow-2xl text-center relative cursor-default"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full blur-[40px] bg-[#6ee7a8]/10 pointer-events-none" />

              <button
                onClick={() => setShowTutorialModal(false)}
                className="absolute top-5 right-5 text-text-dim hover:text-text duration-150 cursor-pointer p-1 rounded-lg"
                title="Fechar"
              >
                <X size={16} />
              </button>

              <span className="text-3xl block mb-4 select-none">📱</span>

              {/* IOS Conditional instructions */}
              {isIOS && (
                <>
                  <h3 className="text-base font-bold text-text-primary tracking-tight uppercase">
                    Instalar DUDE no seu iPhone / iPad
                  </h3>

                  <div className="text-left text-xs text-text-secondary/90 mt-4 space-y-3 leading-relaxed">
                    <p className="font-sans">
                      Siga os passos simplificados abaixo para fixar a <strong className="text-text font-bold">DUDE</strong> na tela inicial do seu celular, com visual nativo em tela cheia:
                    </p>

                    <ol className="list-decimal list-inside space-y-2.5 mt-2 bg-white/5 p-4 rounded-2xl border border-white/5 font-sans">
                      <li>
                        Toque no ícone de <strong className="text-[#6ee7a8] font-bold">Compartilhar</strong> (ícone de retângulo com uma seta apontando para cima <Share size={12} className="inline mx-0.5 text-[#6ee7a8]" />) no Safari.
                      </li>
                      <li>
                        Role a lista e selecione a opção <strong className="text-text font-bold">"Adicionar à Tela de Início"</strong>.
                      </li>
                      <li>
                        Confirme tocando em <strong className="text-[#6ee7a8] font-bold">"Adicionar"</strong> no canto superior direito.
                      </li>
                    </ol>
                  </div>
                </>
              )}

              {/* Android Fallback instruction */}
              {isAndroid && (
                <>
                  <h3 className="text-base font-bold text-text-primary tracking-tight uppercase">
                    Instalar DUDE no seu Android
                  </h3>

                  <div className="text-left text-xs text-text-secondary/90 mt-4 space-y-3 leading-relaxed">
                    <p className="font-sans">
                      Como o prompt automático não iniciou, você pode instalar facilmente via menu do navegador:
                    </p>

                    <ol className="list-decimal list-inside space-y-2.5 mt-2 bg-white/5 p-4 rounded-2xl border border-white/5 font-sans">
                      <li>
                        Toque no menu de <strong className="text-[#6ee7a8] font-bold">Configurações</strong> (ícone de três pontos empilhados ⋮ no topo ou base do navegador).
                      </li>
                      <li>
                        Selecione a opção <strong className="text-text font-bold">"Instalar aplicativo"</strong> ou <strong className="text-text font-bold">"Adicionar à tela inicial"</strong>.
                      </li>
                      <li>
                        Confirme a instalação para criar o atalho oficial.
                      </li>
                    </ol>
                  </div>
                </>
              )}

              {/* Desktop Chromium platform instruction */}
              {isDesktop && (
                <>
                  <h3 className="text-base font-bold text-text-primary tracking-tight uppercase">
                    Instalar DUDE no Computador
                  </h3>

                  <div className="text-left text-xs text-text-secondary/90 mt-4 space-y-3 leading-relaxed">
                    <p className="font-sans">
                      Adicione a <strong className="text-text font-bold">DUDE</strong> na sua barra de tarefas/aplicativos de desktop:
                    </p>

                    <ol className="list-decimal list-inside space-y-2.5 mt-2 bg-white/5 p-4 rounded-2xl border border-white/5 font-sans">
                      <li>
                        Observe a <strong className="text-[#6ee7a8] font-bold">barra de endereço</strong> no topo do seu navegador Chrome/Edge.
                      </li>
                      <li>
                        A direita, localize e clique no <strong className="text-text font-bold inline-flex items-center gap-1">ícone de instalação <Monitor size={12} className="inline text-[#6ee7a8]" /></strong> (um computador com seta para baixo ou sinal de adição +).
                      </li>
                      <li>
                        Ou clique nos três pontos (⋮) e selecione <strong className="text-text font-bold">"Salvar e compartilhar"</strong> &rarr; <strong className="text-text font-bold">"Instalar..."</strong>.
                      </li>
                    </ol>
                  </div>
                </>
              )}

              <div className="mt-6">
                <button
                  onClick={() => setShowTutorialModal(false)}
                  id="pwa-tutorial-close-btn"
                  className="w-full py-3.5 bg-[#6ee7a8] hover:bg-[#52d693] active:scale-98 text-black font-sans font-bold uppercase text-[10px] tracking-widest rounded-2xl transition-all cursor-pointer text-center outline-none"
                >
                  Entendi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
