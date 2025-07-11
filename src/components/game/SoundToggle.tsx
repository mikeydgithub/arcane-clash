
'use client';

import { Button } from '@/components/ui/button';
import { useAudio } from '@/contexts/AudioContext';
import { Volume2, VolumeX } from 'lucide-react';

export function SoundToggle() {
  const { isMuted, toggleMute } = useAudio();

  return (
    <Button
      onClick={toggleMute}
      variant="outline"
      size="icon"
      className="opacity-70 hover:opacity-100 h-9 w-9"
      title={isMuted ? 'Unmute' : 'Mute'}
    >
      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      <span className="sr-only">{isMuted ? 'Unmute' : 'Mute'}</span>
    </Button>
  );
}
