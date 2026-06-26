import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Pause, ArrowUp } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../lib/supabase';

interface DecompressionSessionProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DecompressionSession = ({ isOpen, onClose }: DecompressionSessionProps) => {
  const { user } = useAuthStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [text, setText] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Stop audio when closing
  useEffect(() => {
    if (!isOpen && audioRef.current) {
      audioRef.current.pause();
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
      setTimeout(() => setShowFeedback(false), 2000);
    } catch (err) {
      console.error('Error saving capture:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 13 is Enter. e.keyCode or e.which might be more reliable on older mobile browsers, but e.key is standard.
    // However, the standard fix for mobile "Enter" issue is to have a physical button fallback.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-between text-[#888888] font-sans selection:bg-white/10 selection:text-white">
      {/* Invisible Header */}
      <div className="w-full flex justify-end p-6">
        <button 
          onClick={onClose}
          className="opacity-50 hover:opacity-100 transition-opacity p-2"
          aria-label="Fechar sessão"
        >
          <X size={24} />
        </button>
      </div>

      {/* Center Feedback Overlay */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10, transition: { duration: 0.5 } }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900/80 backdrop-blur-md text-white px-6 py-3 rounded-full text-sm font-medium border border-zinc-800 shadow-2xl z-50 pointer-events-none"
          >
            Captura guardada.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Breathing Animation & Audio */}
      <div className="flex-1 flex flex-col items-center justify-center gap-12 w-full">
        {/* The Breathing Circle */}
        <div className="relative flex items-center justify-center h-48 w-48">
          <motion.div
            animate={{ 
              scale: [1, 1.8, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{
              duration: 10, // 4s inhale + 6s exhale
              ease: "easeInOut",
              repeat: Infinity,
              times: [0, 0.4, 1] // 4s / 10s = 0.4
            }}
            className="absolute w-24 h-24 bg-[#1a1a1a] rounded-full blur-2xl"
          />
          <motion.div
            animate={{ 
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 10,
              ease: "easeInOut",
              repeat: Infinity,
              times: [0, 0.4, 1]
            }}
            className="relative z-10 w-24 h-24 bg-[#0a0a0a] border border-[#1a1a1a] rounded-full shadow-[0_0_30px_rgba(26,26,26,0.3)]"
          />
        </div>

        {/* Audio Player */}
        <div className="flex flex-col items-center gap-4">
          <button 
            onClick={toggleAudio}
            className="w-12 h-12 flex items-center justify-center rounded-full border border-[#222222] bg-[#050505] hover:bg-[#111111] transition-colors"
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" className="ml-1" />
            )}
          </button>
          {/* Mock Brown Noise Audio */}
          <audio 
            ref={audioRef} 
            src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" 
            loop 
            className="hidden" 
          />
        </div>
      </div>

      {/* The Vault (Esvaziamento) */}
      <div className="w-full max-w-2xl px-6 pb-8 sm:pb-20 relative">
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Esvazie a mente... (Pressione Enter para guardar)"
            className="w-full h-32 bg-transparent focus:ring-0 focus:outline-none resize-none text-white/80 placeholder:text-[#333333] text-lg sm:text-xl font-light leading-relaxed scrollbar-hide pr-12"
            autoFocus
          />
          
          {/* Mobile Send Button */}
          <button
            onClick={handleSave}
            disabled={!text.trim()}
            className="absolute bottom-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-indigo-500 text-white disabled:opacity-30 disabled:bg-zinc-800 disabled:text-zinc-500 transition-all cursor-pointer"
            aria-label="Guardar captura"
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};
