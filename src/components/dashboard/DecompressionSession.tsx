import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause } from 'lucide-react';
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

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!text.trim() || !user) return;

      const contentToSave = text;
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
      <div className="w-full max-w-2xl px-6 pb-20 relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Esvazie a mente... (Pressione Enter para guardar)"
          className="w-full h-32 bg-transparent focus:ring-0 focus:outline-none resize-none text-white/80 placeholder:text-[#333333] text-lg sm:text-xl font-light leading-relaxed scrollbar-hide"
          autoFocus
        />
        
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.5 } }}
              className="absolute bottom-10 left-6 text-[#444444] text-sm"
            >
              Guardado.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
