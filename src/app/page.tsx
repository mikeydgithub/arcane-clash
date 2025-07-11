
import Image from 'next/image';
import { GameBoard } from '@/components/game/GameBoard';

export default function ArcaneClashPage() {
  // Number of stars to render.
  const numStars = 10;
  const stars = Array.from({ length: numStars }).map((_, i) => (
    <div key={`star-${i}`} className="star"></div>
  ));

  // const spiralConfigs = [
  //   { id: 1, top: '15%', left: '10%', scale: '0.6', delay: '0s', opacity: 0.3 },
  //   { id: 2, top: '60%', left: '85%', scale: '0.9', delay: '-1.3s', opacity: 0.3 },
  //   { id: 3, top: '30%', left: '45%', scale: '0.4', delay: '-2.5s', opacity: 0.3 },
  //   { id: 4, top: '80%', left: '25%', scale: '0.75', delay: '-0.8s', opacity: 0.3 },
  //   { id: 5, top: '5%', left: '70%', scale: '0.5', delay: '-3.1s', opacity: 0.3 },
  // ];

  // const spirals = spiralConfigs.map(config => (
  //   <div
  //     key={`spiral-container-${config.id}`}
  //     className="spiral-container"
  //     style={{
  //       top: config.top,
  //       left: config.left,
  //       transform: `scale(${config.scale})`,
  //       opacity: config.opacity,
  //     }}
  //   >
  //     <div
  //       className="spiral"
  //       style={{
  //         animationName: 'rotateSpiral',
  //         animationDuration: '4s',
  //         animationIterationCount: 'infinite',
  //         animationTimingFunction: 'linear',
  //         animationDelay: config.delay,
  //       }}
  //     ></div>
  //   </div>
  // ));

  const lightningEffectConfigs = [
    { id: 1, top: '10%', left: '20%', scale: '0.6', animationDelay: '0s', rotation: '-15deg' },
    { id: 2, top: '50%', left: '80%', scale: '0.8', animationDelay: '-1.2s', rotation: '10deg' },
    { id: 3, top: '65%', left: '10%', scale: '0.7', animationDelay: '-2.5s', rotation: '5deg' },
    { id: 4, top: '25%', left: '60%', scale: '0.5', animationDelay: '-3.1s', rotation: '20deg' },
  ];

  const lightningEffects = lightningEffectConfigs.map((config, index) => (
    <div
      key={`lightning-${config.id}`}
      className="absolute"
      style={{
        top: config.top,
        left: config.left,
        transform: `scale(${config.scale}) rotate(${config.rotation || '0deg'})`,
        zIndex: 1, 
      }}
    >
      <Image
        src="/lightning-effect.png"
        alt="Lightning effect"
        width={200} 
        height={300} 
        className="animate-lightning-flash" 
        style={{
          objectFit: 'contain', 
          animationDelay: config.animationDelay, 
          height: 'auto', 
        }}
        data-ai-hint="lightning strike"
        priority={index < 2} 
      />
    </div>
  ));


  return (
    <main className="h-screen w-screen text-foreground relative overflow-hidden" style={{ zIndex: 0 }}>
      {/* Flexbox centering container */}
      <div
        style={{
          position: 'fixed',
          inset: 0, // Shorthand for top, right, bottom, left = 0
          zIndex: -10,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* The swirl element */}
        <div
          style={{
            position: 'relative',
            width: '150vmax',
            height: '150vmax',
            animation: 'rotateSpiral 60s linear infinite, slowFadeInOut 20s ease-in-out infinite alternate',
          }}
        >
          <Image
            src="/black_swirl.png"
            alt="Giant black swirl background"
            fill
            style={{
              borderRadius: '50%',
              objectFit: 'cover',
            }}
            data-ai-hint="abstract background"
            priority
          />
        </div>
      </div>
      {stars}
      {/* {spirals} */} {/* CSS spirals commented out */}
      {lightningEffects}
      <div style={{ position: 'relative', zIndex: 2, height: '100%', width: '100%' }}>
        <GameBoard />
      </div>
    </main>
  );
}
