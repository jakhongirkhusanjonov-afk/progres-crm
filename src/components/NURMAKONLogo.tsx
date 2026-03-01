"use client";

import Image from "next/image";

interface NURMAKONLogoProps {
  width?: number;
  height?: number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

export default function NURMAKONLogo({
  width = 60,
  height = 60,
  className = "",
  showText = false,
  textClassName = "text-2xl font-extrabold tracking-tighter bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent transition-all duration-200 hover:scale-105 hover:from-blue-500 hover:via-indigo-400 hover:to-purple-500 select-none",
}: NURMAKONLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/NURMAKON-logo.svg"
        alt="NURMAKON - Rivojlanish markazi"
        width={width}
        height={height}
        className="flex-shrink-0"
        priority
      />

      {showText && (
        <span className={textClassName} style={{ display: 'inline-block' }}>
          NURMAKON
        </span>
      )}
    </div>
  );
}
