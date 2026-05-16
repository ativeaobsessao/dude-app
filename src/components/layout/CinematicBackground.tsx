import React, { useEffect, useState, useMemo } from 'react';
import { motion, useSpring, useMotionValue, useTransform } from 'motion/react';

export const CinematicBackground = () => {
  const [isMobile, setIsMobile] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth transitions for mouse movement
  const springX = useSpring(mouseX, { stiffness: 40, damping: 30 });
  const springY = useSpring(mouseY, { stiffness: 40, damping: 30 });

  // Trail effect spring
  const trailX = useSpring(mouseX, { stiffness: 20, damping: 25 });
  const trailY = useSpring(mouseY, { stiffness: 20, damping: 25 });

  useEffect(() => {
    // Definir imediatamente o estado de mobile para evitar flashes ou execuÃ§Ã£o de hooks de animaÃ§Ã£o
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const handleMouseMove = (e: MouseEvent) => {
      // SÃ³ atualiza se nÃ£o for mobile
      if (window.innerWidth >= 768) {
        mouseX.set(e.clientX);
        mouseY.set(e.clientY);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [mouseX, mouseY]);

  // Se for mobile, nÃ£o renderiza nada deste componente. 
  // O index.css deve lidar com o fundo base escuro.
  if (isMobile) return null;

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-[#050505] pointer-events-none">
      {/* Base Gradient Layers */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(110,231,168,0.06)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(110,231,168,0.04)_0%,transparent_60%)]" />
      
      {/* Dynamic Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />

      {/* Desktop Reactive Glows */}
      <motion.div
        style={{
          x: springX,
          y: springY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        className="absolute w-[600px] h-[600px] bg-primary-green/[0.08] blur-[100px] rounded-full mix-blend-screen"
      />
      <motion.div
        style={{
          x: trailX,
          y: trailY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        className="absolute w-[400px] h-[400px] bg-primary-green/[0.05] blur-[120px] rounded-full"
      />

      {/* Hypnotic Ambient Waves */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              scale: [1, 2.5, 1],
              opacity: [0.03, 0.1, 0.03],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 15 + i * 5,
              repeat: Infinity,
              ease: "linear"
            }}
            style={{
              width: `${60 + i * 20}%`,
              height: `${60 + i * 20}%`,
              willChange: 'transform, opacity'
            }}
            className="absolute border border-primary-green/20 rounded-full blur-[2px]"
          />
        ))}
      </div>

      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.04, 0.1, 0.04],
          x: ['-10%', '10%', '-10%'],
          y: ['-10%', '10%', '-10%'],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "linear"
        }}
        style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
        className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-primary-green/[0.06] blur-[150px] rounded-full"
      />

      <motion.div
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.03, 0.08, 0.03],
          x: ['10%', '-10%', '10%'],
          y: ['10%', '-10%', '10%'],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "linear"
        }}
        style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
        className="absolute bottom-[-20%] right-[-20%] w-[120%] h-[120%] bg-primary-green/[0.04] blur-[130px] rounded-full"
      />

      {/* Scratches and Dust Overlay */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      
      {/* Vignet effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
    </div>
  );
};
