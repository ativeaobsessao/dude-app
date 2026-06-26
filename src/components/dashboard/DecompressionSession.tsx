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
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopAudio();
      setIsPlaying(false);
    }
    
    return () => {
      stopAudio();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(console.error);
      }
    };
  }, [isOpen]);

  const initAudio = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
  };

  const playAudio = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (oscillatorsRef.current.length > 0) return; // already playing

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 3); // 3 second smooth fade in
    
    // Create a deep, soothing drone using multiple oscillators
    const freqs = [108, 111, 216]; // Solfeggio / Om frequencies
    const oscs: OscillatorNode[] = [];
    
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      
      osc.type = i === 2 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      
      // Slight detune for fullness
      osc.detune.value = i * 4 - 2; 
      
      oscGain.gain.value = 1 / freqs.length;
      
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start();
      oscs.push(osc);
    });

    // Gentle lowpass filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400; 
    
    masterGain.connect(filter);
    filter.connect(ctx.destination);

    oscillatorsRef.current = oscs;
    gainNodeRef.current = masterGain;
  };

  const stopAudio = () => {
    const ctx = audioCtxRef.current;
    const oscs = oscillatorsRef.current;
    const masterGain = gainNodeRef.current;
    
    if (ctx && oscs.length > 0 && masterGain) {
      // Smooth fade out
      masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2); 
      
      setTimeout(() => {
        try {
          oscs.forEach(osc => {
            osc.stop();
            osc.disconnect();
          });
        } catch (e) {
          // ignore
        }
      }, 2100);
      
      oscillatorsRef.current = [];
      gainNodeRef.current = null;
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
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              animate={{ 
                scale: [1 + (i * 0.8), 3.5 + (i * 1.2), 1 + (i * 0.8)], 
                opacity: [0.3 - (i * 0.05), 0.6 - (i * 0.1), 0.3 - (i * 0.05)]
              }}
              transition={{ 
                duration: 8, 
                ease: "easeInOut", 
                repeat: Infinity,
                delay: i * 0.6 
              }}
              className="absolute w-40 h-40 rounded-full border border-zinc-500/20 shadow-[0_0_50px_rgba(255,255,255,0.03)] mix-blend-screen"
              style={{
                backgroundColor: `rgba(63, 63, 70, ${0.05 + (i * 0.01)})`
              }}
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
