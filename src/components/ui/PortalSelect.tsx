import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface PortalSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * PortalSelect
 * ---------------------------------------------------------------------
 * Funciona exatamente como o CustomSelect, porém o painel de opções é
 * renderizado via createPortal diretamente em document.body, com
 * position: fixed calculado a partir do getBoundingClientRect() do
 * botão. Isso resolve o corte visual e o travamento de scroll quando o
 * select está dentro de containers com overflow-hidden (collapsibles do
 * Framer Motion) ou overflow-y-auto (modais roláveis), já que o dropdown
 * deixa de fazer parte da árvore de layout desses containers.
 * ---------------------------------------------------------------------
 */
export const PortalSelect = ({
  options,
  value,
  onChange,
  placeholder = 'Selecionar...',
  className = '',
  disabled = false,
}: PortalSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; openUp: boolean }>({
    top: 0,
    left: 0,
    width: 0,
    openUp: false,
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  const computePosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();

    // Altura estimada do painel (limitada pelo max-h-60 abaixo ~15rem = 240px, + margem)
    const estimatedPanelHeight = 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < estimatedPanelHeight && spaceAbove > spaceBelow;

    setCoords({
      top: openUp ? rect.top : rect.bottom,
      left: rect.left,
      width: rect.width,
      openUp,
    });
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      computePosition();
    }
    setIsOpen(prev => !prev);
  };

  // Recalcula posição em scroll/resize enquanto aberto (captura scroll em qualquer ancestral)
  useEffect(() => {
    if (!isOpen) return;

    const handleReposition = () => computePosition();
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);

    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, computePosition]);

  // Fecha ao clicar fora (considerando botão e painel portalizado)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fecha com ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onMouseDown={(e) => {
          if (disabled) return;
          e.preventDefault();
          handleToggle();
        }}
        className={`w-full bg-surface-2 border border-border-custom rounded-2xl p-4 text-left text-text outline-none focus:border-green transition-all touch-manipulation min-h-[44px] flex items-center justify-between gap-2 min-w-0 ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
      >
        <span className={`truncate text-left flex-1 min-w-0 block ${selected ? 'text-text' : 'text-text-dim/50'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-text-dimmer transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: coords.openUp ? undefined : coords.top + 8,
            bottom: coords.openUp ? window.innerHeight - coords.top + 8 : undefined,
            left: coords.left,
            width: coords.width,
            zIndex: 999999,
          }}
          className="bg-surface-2 border border-border-custom rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          <div className="max-h-60 overflow-y-auto overscroll-contain">
            {options.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-left text-sm transition-colors hover:bg-green/10 hover:text-green ${
                  option.value === value
                    ? 'text-green bg-green/10 font-bold'
                    : 'text-text'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
