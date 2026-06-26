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

  // O "Motor" do Autoplay
  useEffect(() => {
    if (isOpen && audioRef.current) {
      // Assim que abre a tela, força o play na frequência marrom
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        // Fallback caso o navegador do celular bloqueie o autoplay por economia de bateria
        console.warn("Autoplay bloqueado pelo navegador.", err);
        setIsPlaying(false);
      });
    } else if (!isOpen && audioRef.current) {
      // Quando fecha a tela, pausa o áudio
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

  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (!isOpen) return null;

  return (
    <div 
      onClick={handleContainerClick}
      className="fixed inset-0 z-[100] bg-black flex flex-col justify-between text-white font-sans"
    >
      {/* Cabeçalho */}
      <div className="flex justify-end p-6">
        <button 
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="text-zinc-600 hover:text-zinc-300 transition-colors p-2"
        >
          <X size={28} strokeWidth={1.5} />
        </button>
      </div>

      {/* Centro da Tela - Ancoragem Minimalista */}
      <div className="flex-1 flex flex-col items-center justify-center relative -mt-10">
        {/* Círculo com respiração sutil */}
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 8, ease: "easeInOut", repeat: Infinity }}
          className="w-48 h-48 rounded-full border border-zinc-800/40 absolute"
        />
        
        {/* Áudio Player Minimalista */}
        <div className="relative z-10 mt-64">
          <button 
            type="button"
            onClick={toggleAudio}
            className="rounded-full p-4 hover:bg-zinc-900 transition-colors flex items-center justify-center border border-zinc-800/60"
          >
            {isPlaying ? <Pause size={20} className="text-zinc-500" /> : <Play size={20} className="text-zinc-500 ml-1" />}
          </button>
          
          {/* Frequência Marrom Oficial (Brown Noise) */}
          <audio 
            ref={audioRef} 
            src="https://upload.wikimedia.org/wikipedia/commons/d/d0/Brown_noise.ogg" 
            loop 
            className="hidden" 
          />
        </div>
      </div>

      {/* Base da Tela - Textarea Imersivo e Translúcido */}
      <div className="w-full px-8 pb-12 relative flex flex-col">
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-zinc-500 text-sm mb-3 font-medium"
            >
              Captura guardada.
            </motion.div>
          )}
        </AnimatePresence>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Esvazie a mente... (Pressione Enter para guardar)"
          className="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none text-zinc-300 placeholder:text-zinc-700 text-lg p-0"
          rows={3}
          autoFocus
        />
      </div>
    </div>
  );
};
