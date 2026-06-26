import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  useEffect(() => {
    if (!isOpen && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isOpen]);

  const toggleAudio = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSave = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

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
      e.stopPropagation();
      handleSave(e);
    }
  };

  // Impede que cliques dentro da sessão fechem modais pai acidentalmente
  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (!isOpen) return null;

  return (
    <div 
      onClick={handleContainerClick}
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-between text-white"
    >
      {/* Cabeçalho */}
      <button 
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-6 right-6 opacity-50 hover:opacity-100 transition-opacity p-2 cursor-pointer"
      >
        <X size={24} />
      </button>

      {/* Centro da Tela */}
      <div className="flex-1 flex flex-col items-center justify-center relative w-full">
        {/* Respiração (Framer Motion) */}
        <motion.div
          animate={{ scale: [1, 1.5, 1] }}
          transition={{ duration: 10, ease: "easeInOut", repeat: Infinity }}
          className="w-48 h-48 rounded-full bg-zinc-800/40 blur-2xl absolute"
        />
        
        {/* Áudio Player */}
        <div className="relative z-10">
          <button 
            type="button"
            onClick={toggleAudio}
            className="border border-zinc-700 rounded-full p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            {isPlaying ? <Pause size={24} className="text-zinc-300" /> : <Play size={24} className="text-zinc-300 ml-1" />}
          </button>
          <audio ref={audioRef} src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" loop className="hidden" />
        </div>
      </div>

      {/* Base da Tela (O Cofre de Captura) */}
      <div className="w-full max-w-lg px-6 pb-12 relative flex flex-col items-center">
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.5 } }}
              className="absolute -top-8 text-zinc-400 text-sm font-medium"
            >
              Captura guardada.
            </motion.div>
          )}
        </AnimatePresence>

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
            type="button"
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
