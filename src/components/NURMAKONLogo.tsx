"use client";

interface NURMAKONLogoProps {
  width?: number;
  height?: number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

export default function NURMAKONLogo({
  className = "",
  textClassName = "text-2xl font-extrabold tracking-tighter bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent transition-all duration-200 hover:scale-105 select-none",
}: NURMAKONLogoProps) {
  return (
    <div className={`flex items-center py-1 px-1 ${className}`}>
      <span className={textClassName} style={{ display: 'inline-block' }}>
        NURMAKON
      </span>
    </div>
  );
}
