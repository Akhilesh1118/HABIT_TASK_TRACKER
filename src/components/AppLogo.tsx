import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
}

export const AppLogo: React.FC<AppLogoProps> = ({ className = '', size = 38 }) => {
  return (
    <div
      className={`relative flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xs"
      >
        <defs>
          {/* Main Leaf Gradient - Fresh Lime to Vibrant Emerald */}
          <linearGradient id="refLeafMain" x1="14" y1="4" x2="36" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4ADE80" />
            <stop offset="50%" stopColor="#22C55E" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>

          {/* Inner Leaf Fold / Highlight Gradient */}
          <linearGradient id="refLeafHighlight" x1="18" y1="6" x2="32" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#86EFAC" />
            <stop offset="60%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          {/* Lower Circular Badge / Ring Gradient */}
          <linearGradient id="refCircleBody" x1="10" y1="18" x2="36" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0D9488" />
            <stop offset="50%" stopColor="#0F766E" />
            <stop offset="100%" stopColor="#064E3B" />
          </linearGradient>

          {/* Subtle Outer Progress Glow */}
          <linearGradient id="refProgressArc" x1="8" y1="20" x2="36" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>

        {/* Back Leaf Shape (Curving Sprout) */}
        <path
          d="M22 24C20 16 24 7 34 5C34 13 30 21 24 25.5C23.2 26 22.5 25.2 22 24Z"
          fill="url(#refLeafMain)"
        />

        {/* Primary Dynamic Leaf Body (Flowing into circular base) */}
        <path
          d="M17 26C15 18 19 8 30 5C32 5 33 6.5 31.5 8C27 12.5 24 18 24 25C24 26.5 23 27 21.5 27C19.5 27 18 26.8 17 26Z"
          fill="url(#refLeafHighlight)"
          opacity="0.95"
        />

        {/* Leaf Central Rib Line Accent */}
        <path
          d="M23 24C25 18 28 12 33 6.5"
          stroke="#DCFCE7"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity="0.8"
        />

        {/* Outer Circular Progress Ring Track Accent */}
        <circle
          cx="22"
          cy="31"
          r="12.5"
          stroke="url(#refProgressArc)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="60 18"
          transform="rotate(-55 22 31)"
        />

        {/* Lower Circular Badge Base (Teal/Emerald solid core) */}
        <circle
          cx="22"
          cy="31"
          r="11"
          fill="url(#refCircleBody)"
        />

        {/* Clean Crisp White Checkmark */}
        <path
          d="M17.5 31L20.5 34L26.5 28"
          stroke="#FFFFFF"
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
