"use client";

import type { LetterResult } from "@/lib/game";

const colorMap: Record<LetterResult, string> = {
  correct: "bg-green-600 border-green-600 text-white",
  present: "bg-yellow-500 border-yellow-500 text-white",
  absent: "bg-neutral-700 border-neutral-700 text-white",
};

interface TileProps {
  letter: string;
  result?: LetterResult;
  isCurrent?: boolean;
}

export default function Tile({ letter, result, isCurrent }: TileProps) {
  const base =
    "w-14 h-14 sm:w-16 sm:h-16 border-2 flex items-center justify-center text-2xl sm:text-3xl font-bold uppercase transition-colors duration-300 select-none";

  let style: string;
  if (result) {
    style = colorMap[result];
  } else if (letter) {
    style = "border-neutral-500 text-white bg-transparent";
  } else {
    style = "border-neutral-600 text-white bg-transparent";
  }

  return (
    <div
      className={`${base} ${style} ${isCurrent && letter ? "scale-105" : ""}`}
    >
      {letter}
    </div>
  );
}
