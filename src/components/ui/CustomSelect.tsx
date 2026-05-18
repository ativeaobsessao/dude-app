import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const CustomSelect = ({ options, value, onChange, placeholder = 'Selecionar...', className = '' }: CustomSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-left text-text-primary outline-none focus:border-primary-green transition-all touch-manipulation min-h-[44px] flex items-center justify-between gap-2"
      >
        <span className={selected ? 'text-text-primary' : 'text-text-secondary/50'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown 
          size={16} 
          className={`text-text-secondary/40 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-white/20 rounded-2xl overflow-hidden z-[9999] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          <div className="max-h-48 overflow-y-auto">
            {options.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-left text-sm transition-colors hover:bg-primary-green/10 hover:text-primary-green ${
                  option.value === value 
                    ? 'text-primary-green bg-primary-green/10 font-bold' 
                    : 'text-text-primary'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
