
'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useAudio } from '@/contexts/AudioContext';
import { Volume2, VolumeX, Music, Zap, Volume1 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AudioController() {
  const { volumes, setVolume, isMuted } = useAudio();

  const handleMasterChange = (value: number[]) => setVolume('master', value[0]);
  const handleMusicChange = (value: number[]) => setVolume('music', value[0]);
  const handleSfxChange = (value: number[]) => setVolume('sfx', value[0]);

  const Icon = isMuted ? VolumeX : Volume2;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="opacity-70 hover:opacity-100 h-9 w-9"
          title="Audio Settings"
        >
          <Icon className="h-4 w-4" />
          <span className="sr-only">Audio Settings</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Audio Settings</h4>
            <p className="text-sm text-muted-foreground">
              Adjust your game volume.
            </p>
          </div>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="master-volume" className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" /> Master
              </Label>
              <Slider
                id="master-volume"
                defaultValue={[volumes.master]}
                max={1}
                step={0.05}
                onValueChange={handleMasterChange}
                aria-label="Master Volume"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="music-volume" className="flex items-center gap-2">
                <Music className="h-4 w-4" /> Music
              </Label>
              <Slider
                id="music-volume"
                defaultValue={[volumes.music]}
                max={1}
                step={0.05}
                onValueChange={handleMusicChange}
                aria-label="Music Volume"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sfx-volume" className="flex items-center gap-2">
                <Zap className="h-4 w-4" /> SFX
              </Label>
              <Slider
                id="sfx-volume"
                defaultValue={[volumes.sfx]}
                max={1}
                step={0.05}
                onValueChange={handleSfxChange}
                aria-label="Sound Effects Volume"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
