import { GameBoard } from '@/components/game/GameBoard';

export default function ArcaneClashPage() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-background text-foreground bg-starry-pattern">
      <GameBoard />
    </main>
  );
}
