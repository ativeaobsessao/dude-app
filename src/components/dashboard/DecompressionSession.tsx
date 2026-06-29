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
  const [sleepTimer, setSleepTimer] = useState<number>(30); // Sleep timer in minutes
  
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
      stopAudio();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(console.error);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isPlaying && sleepTimer > 0) {
      timeout = setTimeout(() => {
        stopAudio();
        setIsPlaying(false);
      }, sleepTimer * 60 * 1000);
    }
    return () => clearTimeout(timeout);
  }, [isPlaying, sleepTimer]);

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

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 3); // 3 second smooth fade in
    
    // Gentle lowpass filter for deep rumble like Calm app
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 350; 
    
    source.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    source.start();

    sourceRef.current = source;
    gainNodeRef.current = masterGain;
  };

  const stopAudio = () => {
    const ctx = audioCtxRef.current;
    const source = sourceRef.current;
    const masterGain = gainNodeRef.current;
    
    if (ctx && source && masterGain) {
      // Smooth fade out
      masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2); 
      
      setTimeout(() => {
        try {
          source.stop();
          source.disconnect();
        } catch (e) {
          // ignore
        }
      }, 2100);
      
      sourceRef.current = null;
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
      <div className="flex justify-between p-6 relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs mr-2">Desligar áudio em:</span>
          {[15, 30, 60].map((t) => (
            <button
              key={t}
              onClick={(e) => {
                e.stopPropagation();
                setSleepTimer(t);
              }}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors border ${sleepTimer === t ? 'bg-zinc-800 text-zinc-200 border-zinc-700' : 'bg-transparent text-zinc-600 border-zinc-800 hover:text-zinc-400'}`}
            >
              {t}m
            </button>
          ))}
        </div>
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
        {/* Círculos concêntricos - Apple-style pendulum */}
        <motion.div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial="initial"
          animate="animate"
          variants={{
            animate: {
              transition: {
                staggerChildren: 0.5
              }
            }
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              variants={{
                initial: { scale: 0.8, opacity: 0 },
                animate: { 
                  scale: [0.8, 1.2, 0.8], 
                  opacity: [0.2, 0.6, 0.2],
                  transition: { 
                    duration: 6, 
                    ease: "easeInOut", 
                    repeat: Infinity
                  }
                }
              }}
              className="absolute rounded-full border border-white/30 w-[80vw] h-[80vw] max-w-[400px] max-h-[400px]"
              style={{
                backgroundColor: `rgba(255, 255, 255, 0.04)`
              }}
            />
          ))}
        </motion.div>
        
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
