
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
      key={`spiral-${config.id}`} 
      className="spiral-container" 
      style={{ 
        top: config.top, 
        left: config.left, 
        transform: `scale(${config.scale})`,
        opacity: config.opacity, // Applied here
        animationDelay: config.delay, 
      }}
    >
      <div className="spiral" style={{ animationDelay: config.delay }}></div>
    </div>
  ));

  return (
    <main className="h-screen w-screen overflow-hidden text-foreground relative">
      {/* Render the stars. They are position:absolute and will adhere to .star CSS rules. */}
      {stars}
      {/* Render the spirals */}
      {spirals}
      <GameBoard />
    </main>
  );
}

    