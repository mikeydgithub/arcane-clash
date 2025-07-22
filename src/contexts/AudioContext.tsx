
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
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const hasInteracted = useRef(false);

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
    });

    // Get the background music element from the DOM
    const musicElement = document.getElementById('background-music');
    if (musicElement instanceof HTMLAudioElement) {
        backgroundMusicRef.current = musicElement;
        backgroundMusicRef.current.volume = 0.1;
    }

    const handleFirstInteraction = () => {
        if (!hasInteracted.current) {
            hasInteracted.current = true;
            if (backgroundMusicRef.current && !isMuted) {
                backgroundMusicRef.current.play().catch(e => console.error("BG music play failed on interaction:", e));
            }
        }
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('keydown', handleFirstInteraction);
    };
    
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);

    return () => {
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('keydown', handleFirstInteraction);
    };

  }, [isMuted]);

  useEffect(() => {
    const music = backgroundMusicRef.current;
    if (music) {
        if (isMuted) {
            music.pause();
        } else if (hasInteracted.current) {
            music.play().catch(e => console.error("Error playing background music:", e));
        }
    }
  }, [isMuted]);


  const play = useCallback((sound: SoundEffect) => {
    if (!isMuted && hasInteracted.current) {
      const audio = audioRefs.current[sound];
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.error(`Error playing sound: ${sound}`, e));
      }
    }
  }, [isMuted]);

  const toggleMute = () => {
    setIsMuted(prev => !prev);
    // No click sound on toggle, as it might be the first interaction
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
