import { GameBoard } from '@/components/game/GameBoard';

export default function ArcaneClashPage() {
  // Number of stars to render. Ensure this matches the number of .star:nth-child() selectors in globals.css if using that method.
  const numStars = 10; 
  const stars = Array.from({ length: numStars }).map((_, i) => (
    <div key={`star-${i}`} className="star"></div>
  ));

  const spiralConfigs = [
    { id: 1, top: '15%', left: '20%', scale: '0.7', delay: '0s' },
    { id: 2, top: '60%', left: '75%', scale: '1.0', delay: '-1.3s' },
    { id: 3, top: '30%', left: '50%', scale: '0.5', delay: '-2.5s' },
  ];

  const spirals = spiralConfigs.map(config => (
    <div 
      key={`spiral-${config.id}`} 
      className="spiral-container" 
      style={{ 
        top: config.top, 
        left: config.left, 
        transform: `scale(${config.scale})`,
        animationDelay: config.delay, // Apply delay to the container if needed, or directly to .spiral if preferred
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
