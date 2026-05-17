import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { CHARACTERS } from '../constants';

export const LoadingAnimation = () => {
  const eyePos = { x: 0, y: 0 }; // Static for loading

  // Generate 30 characters with random positions
  const loadingCharacters = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => {
      const char = CHARACTERS[i % CHARACTERS.length];
      return {
        ...char,
        x: `${Math.random() * 120 - 10}%`,
        y: `${Math.random() * 120 - 10}%`,
        delay: Math.random() * 2,
        size: Math.random() > 0.5 ? 'w-48 h-48' : 'w-32 h-32',
        floatDuration: 3 + Math.random() * 3
      };
    });
  }, []);

  return (
    <div className="absolute inset-0 bg-white z-[600] flex flex-col items-center justify-center overflow-hidden">
      {/* Floating Characters Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {loadingCharacters.map((char, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: char.x, top: char.y }}
            initial={{ opacity: 0, scale: 0, rotate: char.rotate }}
            animate={{ 
              opacity: 0.6, 
              scale: 1, 
              rotate: char.rotate,
              y: [0, -30, 0]
            }}
            transition={{ 
              opacity: { delay: char.delay, duration: 1 },
              scale: { delay: char.delay, type: 'spring', stiffness: 50 },
              y: {
                duration: char.floatDuration,
                repeat: Infinity,
                ease: "easeInOut",
                delay: char.delay
              }
            }}
          >
            <svg viewBox="-10 -10 120 120" className={`${char.size} overflow-visible opacity-40`}>
              <g stroke="none" fill="none">
                {char.accessory === 'hat' && (
                  <path d="M35,15 L65,15 L50,0 Z" fill="rgba(0,0,0,0.2)" />
                )}
                {char.accessory === 'glasses' && (
                  <g stroke="rgba(0,0,0,0.2)" strokeWidth="3">
                    <circle cx="35" cy="45" r="8" />
                    <circle cx="65" cy="45" r="8" />
                    <line x1="43" y1="45" x2="57" y2="45" />
                  </g>
                )}
                {char.accessory === 'arms' && (
                  <g stroke="rgba(0,0,0,0.2)" strokeWidth="3">
                    <path d="M15,50 Q5,50 10,40" />
                    <path d="M85,50 Q95,50 90,60" />
                  </g>
                )}
                {char.accessory === 'legs' && (
                  <g stroke="rgba(0,0,0,0.2)" strokeWidth="3">
                    <path d="M35,85 L30,95" />
                    <path d="M65,85 L70,95" />
                  </g>
                )}
              </g>

              <path d={char.shape} fill={char.color} />
              
              <g transform="translate(50, 45)">
                <circle cx="-12" cy="0" r="5" fill="white" />
                <circle cx="12" cy="0" r="5" fill="white" />
                <circle cx="-12" cy="0" r="2.5" fill="black" />
                <circle cx="12" cy="0" r="2.5" fill="black" />
                <path d="M-3,8 Q0,10 3,8" fill="none" stroke="black" strokeWidth="1.5" strokeLinecap="round" />
              </g>
            </svg>
          </motion.div>
        ))}
      </div>

      {/* Center Text */}
      <div className="relative z-10 text-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-24 h-24 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-8" />
        </motion.div>
        <motion.p 
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          className="font-mono text-black text-xl tracking-[0.3em] font-bold"
        >
          SOUL AWAKENING...
        </motion.p>
      </div>
    </div>
  );
};
