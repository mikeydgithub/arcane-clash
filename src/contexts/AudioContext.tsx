
'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

type SoundEffect = 'card-play' | 'attack' | 'damage' | 'heal' | 'win' | 'lose' | 'coin-flip' | 'click';

interface AudioVolumes {
  master: number;
  music: number;
  sfx: number;
}

interface AudioContextType {
  volumes: AudioVolumes;
  setVolume: (type: keyof AudioVolumes, volume: number) => void;
  isMuted: boolean;
  play: (sound: SoundEffect) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [volumes, setVolumes] = useState<AudioVolumes>({
    master: 1,
    music: 0.1,
    sfx: 0.3,
  });

  const audioRefs = useRef<Record<SoundEffect, HTMLAudioElement | null>>({
    'card-play': null, 'attack': null, 'damage': null, 'heal': null,
    'win': null, 'lose': null, 'coin-flip': null, 'click': null,
  });

  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const hasInteracted = useRef(false);

  useEffect(() => {
    // Pre-load audio elements
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
    
    const musicElement = document.getElementById('background-music');
    if (musicElement instanceof HTMLAudioElement) {
        backgroundMusicRef.current = musicElement;
    }

    const handleFirstInteraction = () => {
        if (!hasInteracted.current) {
            hasInteracted.current = true;
            if (backgroundMusicRef.current) {
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
  }, []);

  const isMuted = volumes.master === 0;

  useEffect(() => {
    const music = backgroundMusicRef.current;
    if (music) {
      const effectiveMusicVolume = volumes.music * volumes.master;
      music.volume = effectiveMusicVolume;
      if (effectiveMusicVolume > 0 && hasInteracted.current && music.paused) {
        music.play().catch(e => console.error("Error playing background music:", e));
      } else if (effectiveMusicVolume === 0) {
        music.pause();
      }
    }
  }, [volumes]);

  useEffect(() => {
    Object.values(audioRefs.current).forEach(audio => {
      if (audio) {
        audio.volume = volumes.sfx * volumes.master;
      }
    });
  }, [volumes.sfx, volumes.master]);

  const play = useCallback((sound: SoundEffect) => {
    if (volumes.master > 0 && volumes.sfx > 0 && hasInteracted.current) {
      const audio = audioRefs.current[sound];
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.error(`Error playing sound: ${sound}`, e));
      }
    }
  }, [volumes]);

  const setVolume = (type: keyof AudioVolumes, volume: number) => {
    setVolumes(prev => ({ ...prev, [type]: volume }));
  };

  return (
    <AudioContext.Provider value={{ volumes, setVolume, isMuted, play }}>
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
