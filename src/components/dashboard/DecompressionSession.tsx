import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  
  // Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopAudio();
      setIsPlaying(false);
    }
    
    return () => {
      // Cleanup on unmount
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(console.error);
      }
    };
  }, [isOpen]);

  const initAudio = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      // Create 10 seconds of Brown Noise buffer
      const bufferSize = ctx.sampleRate * 10;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // compensate gain
      }

      (ctx as any).brownNoiseBuffer = buffer;
    }
  };

  const playAudio = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (sourceRef.current) return; // already playing

    const source = ctx.createBufferSource();
    source.buffer = (ctx as any).brownNoiseBuffer;
    source.loop = true;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 2); // 2 second smooth fade in

    // Lowpass filter for a soothing, deep rumble (like the ocean/Calm app)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 350; 
    
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start();

    sourceRef.current = source;
    gainNodeRef.current = gainNode;
  };

  const stopAudio = () => {
    const ctx = audioCtxRef.current;
    const source = sourceRef.current;
    const gainNode = gainNodeRef.current;
    
    if (ctx && source && gainNode) {
      // 1.5 second smooth fade out to prevent clicks
      gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5); 
      
      setTimeout(() => {
        try {
          source.stop();
          source.disconnect();
        } catch (e) {
          // ignore if already stopped
        }
      }, 1600);
      
      sourceRef.current = null;
    }
  };

  const toggleAudio = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isPlaying) {
      stopAudio();
    } else {
      playAudio();
    }
    setIsPlaying(!isPlaying);
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
        {/* Círculos com respiração sutil e visível simulando lótus/pulsação */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ 
                scale: [1 + (i * 0.15), 1.4 + (i * 0.25), 1 + (i * 0.15)], 
                opacity: [0.3 - (i * 0.1), 0.6 - (i * 0.15), 0.3 - (i * 0.1)] 
              }}
              transition={{ 
                duration: 7, 
                ease: "easeInOut", 
                repeat: Infinity,
                delay: i * 0.6 
              }}
              className="absolute w-56 h-56 rounded-full bg-zinc-800/20 border border-zinc-600/30 shadow-[0_0_30px_rgba(39,39,42,0.1)]"
            />
          ))}
        </div>
        
        {/* Áudio Player Minimalista */}
        <div className="relative z-10 mt-64">
          <button 
            type="button"
            onClick={toggleAudio}
            className="rounded-full p-4 bg-zinc-900/80 hover:bg-zinc-800 transition-colors flex items-center justify-center border border-zinc-700/60 shadow-lg"
          >
            {isPlaying ? <Pause size={24} className="text-zinc-400" /> : <Play size={24} className="text-zinc-400 ml-1" />}
          </button>
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
