
'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

type SoundEffect = 'card-play' | 'attack' | 'damage' | 'heal' | 'win' | 'lose' | 'coin-flip' | 'click';

interface AudioContextType {
  isMuted: boolean;
  toggleMute: () => void;
  play: (sound: SoundEffect) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMuted, setIsMuted] = useState(false);
  const audioRefs = useRef<Record<SoundEffect, HTMLAudioElement | null>>({
    'card-play': null,
    'attack': null,
    'damage': null,
    'heal': null,
    'win': null,
    'lose': null,
    'coin-flip': null,
    'click': null,
  });

  useEffect(() => {
    // Pre-load audio elements on the client
    audioRefs.current = {
      'card-play': new Audio('/audio/card-play.wav'),
      'attack': new Audio('/audio/attack.wav'),
      'damage': new Audio('/audio/damage.wav'),
      'heal': new Audio('/audio/heal.wav'),
      'win': new Audio('/audio/win.wav'),
      'lose': new Audio('/audio/lose.wav'),
      'coin-flip': new Audio('/audio/coin-flip.wav'),
      'click': new Audio('/audio/click.wav'),
    };
    Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
            audio.volume = 0.3; // Set a default volume for sound effects
        }
    })
  }, []);

  const play = useCallback((sound: SoundEffect) => {
    if (!isMuted) {
      const audio = audioRefs.current[sound];
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.error(`Error playing sound: ${sound}`, e));
      }
    }
  }, [isMuted]);

  const toggleMute = () => {
    setIsMuted(prev => !prev);
    play('click');
  };

  return (
    <AudioContext.Provider value={{ isMuted, toggleMute, play }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
