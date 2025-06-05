import { GameBoard } from '@/components/game/GameBoard';

export default function ArcaneClashPage() {
  // Number of stars to render. Ensure this matches the number of .star:nth-child() selectors in globals.css if using that method.
  const numStars = 10; 
  const stars = Array.from({ length: numStars }).map((_, i) => (
    <div key={`star-${i}`} className="star"></div>
  ));

  return (
    <main className="h-screen w-screen overflow-hidden text-foreground relative">
      {/* Render the stars. They are position:absolute and will adhere to .star CSS rules. */}
      {stars}
      <GameBoard />
    </main>
  );
}
