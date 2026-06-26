import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, ArrowUp } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../lib/supabase';

interface DecompressionSessionProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DecompressionSession = ({ isOpen, onClose }: DecompressionSessionProps) => {
  const { user } = useAuthStore();
  const [isPlaying, setIsPlaying] = useState(true);
  const [text, setText] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [isOpen]);

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSave = async () => {
    if (!text.trim() || !user) return;
    
    const contentToSave = text.trim();
    setText('');
    
    try {
      await supabase.from('inbox_captures').insert({
        user_id: user.id,
        content: contentToSave
      });
      
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 2500);
    } catch (err) {
      console.error('Error saving capture:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-between text-white">
      <style>{`
        @keyframes breathe-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.25); }
        }
        .animate-breathe {
          animation: breathe-pulse 10s ease-in-out infinite;
        }
        @keyframes fade-out {
          0% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }
        .animate-feedback {
          animation: fade-out 2.5s ease-out forwards;
        }
      `}</style>

      {/* Cabeçalho */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 opacity-50 hover:opacity-100 transition-opacity p-2 cursor-pointer z-50"
      >
        <X size={24} />
      </button>

      {/* Centro da Tela */}
      <div className="flex-1 flex flex-col items-center justify-center relative w-full">
        {/* Respiração (CSS nativo) */}
        <div className="w-64 h-64 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-900 blur-3xl absolute animate-breathe" />
        
        {/* Áudio Player */}
        <div className="relative z-10">
          <button 
            onClick={toggleAudio}
            className="border border-zinc-700 rounded-full p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            {isPlaying ? <Pause size={24} className="text-zinc-300" /> : <Play size={24} className="text-zinc-300 ml-1" />}
          </button>
          <audio 
            ref={audioRef} 
            src="https://actions.google.com/sounds/v1/noise/brown_noise.ogg" 
            loop 
            autoPlay
            className="hidden" 
          />
        </div>
      </div>

      {/* Base da Tela (O Cofre de Captura) */}
      <div className="w-full max-w-lg px-6 pb-12 relative flex flex-col items-center z-50">
        {showFeedback && (
          <div className="absolute -top-8 text-zinc-400 text-sm font-medium animate-feedback">
            Captura guardada.
          </div>
        )}

        <div className="bg-zinc-900 rounded-3xl p-2 flex items-end shadow-lg w-full">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Esvazie a mente..."
            className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none resize-none text-zinc-100 placeholder:text-zinc-500 px-3 py-2 max-h-32 min-h-[44px] overflow-y-auto"
            rows={2}
            autoFocus
          />
          
          <button
            onClick={handleSave}
            disabled={!text.trim()}
            className="bg-zinc-700 text-white rounded-full p-2 mb-1 mr-1 disabled:opacity-30 disabled:bg-zinc-800 transition-all cursor-pointer flex-shrink-0"
          >
            <ArrowUp size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};
