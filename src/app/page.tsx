
import Image from 'next/image';
import { GameBoard } from '@/components/game/GameBoard';

export default function ArcaneClashPage() {
  // Number of stars to render. Ensure this matches the number of .star:nth-child() selectors in globals.css if using that method.
  const numStars = 10; 
  const stars = Array.from({ length: numStars }).map((_, i) => (
    <div key={`star-${i}`} className="star"></div>
  ));

  const spiralConfigs = [
    { id: 1, top: '15%', left: '10%', scale: '0.6', delay: '0s', opacity: 0.3 },
    { id: 2, top: '60%', left: '85%', scale: '0.9', delay: '-1.3s', opacity: 0.3 },
    { id: 3, top: '30%', left: '45%', scale: '0.4', delay: '-2.5s', opacity: 0.3 },
    { id: 4, top: '80%', left: '25%', scale: '0.75', delay: '-0.8s', opacity: 0.3 },
    { id: 5, top: '5%', left: '70%', scale: '0.5', delay: '-3.1s', opacity: 0.3 },
  ];

  const spirals = spiralConfigs.map(config => (
    <div 
      key={`spiral-container-${config.id}`} 
      className="spiral-container" 
      style={{ 
        top: config.top, 
        left: config.left, 
        transform: `scale(${config.scale})`,
        opacity: config.opacity,
        // animationDelay for the container is not needed if the image itself has its animation delay
      }}
    >
      <Image
        src="/water_swirl.png" // Ensure water_swirl.png is in /public
        alt="Water swirl effect"
        width={100} // Base width of the image, scale transform will adjust final size
        height={100} // Base height of the image
        data-ai-hint="water swirl"
        style={{
          animation: `rotateSpiral 4s linear infinite`,
          animationDelay: config.delay, // Apply individual delay to image rotation
          objectFit: 'contain', 
        }}
        priority={false} // Background decorative element
      />
    </div>
  ));

  const lightningEffectConfigs = [
    { id: 1, top: '10%', left: '20%', scale: 0.7, rotate: '-15deg', animationDelay: '0s' },
    { id: 2, top: '70%', left: '15%', scale: 0.9, rotate: '20deg', animationDelay: '-0.5s' },
    { id: 3, top: '40%', left: '80%', scale: 0.6, rotate: '5deg', animationDelay: '-1s' },
    { id: 4, top: '85%', left: '60%', scale: 0.8, rotate: '-30deg', animationDelay: '-1.5s' },
    { id: 5, top: '25%', left: '50%', scale: 0.5, rotate: '10deg', animationDelay: '-2s' },
  ];

  const lightningEffects = lightningEffectConfigs.map(config => (
    <div
      key={`lightning-${config.id}`}
      className="animate-lightning-flash"
      style={{
        position: 'absolute',
        top: config.top,
        left: config.left,
        transform: `scale(${config.scale}) rotate(${config.rotate})`,
        animationDelay: config.animationDelay, 
        zIndex: 0, 
      }}
    >
      <Image
        src="/lightning-effect.png" 
        alt="Lightning energy effect"
        width={200} 
        height={300} 
        data-ai-hint="lightning energy"
        style={{ objectFit: 'contain' }}
        priority={false} 
      />
    </div>
  ));

  return (
    <main className="h-screen w-screen overflow-hidden text-foreground relative">
      {/* Render the stars. They are position:absolute and will adhere to .star CSS rules. */}
      {stars}
      {/* Render the spirals (now image-based) */}
      {spirals}
      {/* Render the lightning effects */}
      {lightningEffects}
      <GameBoard />
    </main>
  );
}
