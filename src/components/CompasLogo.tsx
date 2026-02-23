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
  textClassName = "text-xl font-bold text-orange-600",
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

      {showText && <span className={textClassName}>NURMAKON</span>}
    </div>
  );
}
