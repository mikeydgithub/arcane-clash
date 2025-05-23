'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface GameOverModalProps {
  winnerName?: string;
  onRestart: () => void;
  isOpen: boolean;
}

export function GameOverModal({ winnerName, onRestart, isOpen }: GameOverModalProps) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-3xl text-center">
            {winnerName ? `${winnerName} Wins!` : "It's a Draw!"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-lg pt-2">
            The battle has concluded.
            {winnerName ? ` Congratulations to ${winnerName} on their glorious victory!` : "Both warriors fought valiantly!"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="pt-4">
          <AlertDialogAction asChild>
            <Button onClick={onRestart} className="w-full text-lg py-6 bg-primary hover:bg-primary/90">
              Play Again
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
