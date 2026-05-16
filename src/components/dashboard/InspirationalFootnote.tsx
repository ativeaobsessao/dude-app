import { useDataStore } from '../../store/useDataStore';

export const InspirationalFootnote = () => {
  const { hasCompletedFirstSession } = useDataStore();

  if (!hasCompletedFirstSession) return null;

  return (
    <footer className="mt-20 mb-32 px-6 flex flex-col items-center text-center max-w-5xl mx-auto opacity-40">
      <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.06em] leading-[0.95] text-text-primary mb-4 whitespace-pre-line md:whitespace-normal">
        Tenha Controle Total <br className="md:hidden" />
        <span className="text-white/20">Sobre Seu Tempo</span>
      </h2>
      
      <p className="text-sm md:text-base text-text-secondary font-light max-w-xl leading-snug">
        Com a DUDE você controla o seu presente, registra o seu passado — otimizando ao máximo o seu tempo.
      </p>
    </footer>
  );
};
