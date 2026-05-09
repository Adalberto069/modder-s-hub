interface Props {
  size?: number;
  className?: string;
}

/**
 * Custom brand mark — hexagonal outline with embedded ">_" terminal glyph.
 * Less generic than the lucide Terminal icon used previously.
 */
export function HiddenMark({ size = 28, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hm-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(270 80% 65%)" />
          <stop offset="100%" stopColor="hsl(145 80% 50%)" />
        </linearGradient>
      </defs>
      {/* Hex frame */}
      <path
        d="M16 1.5 L29 9 V23 L16 30.5 L3 23 V9 Z"
        stroke="url(#hm-grad)"
        strokeWidth="1.4"
        fill="hsl(240 15% 5%)"
      />
      {/* Inner hex tick marks */}
      <path d="M3 9 L6 11" stroke="hsl(270 80% 65%)" strokeWidth="1" opacity="0.5" />
      <path d="M29 23 L26 21" stroke="hsl(145 80% 50%)" strokeWidth="1" opacity="0.5" />
      {/* > glyph */}
      <path
        d="M11 12 L15 16 L11 20"
        stroke="hsl(145 80% 50%)"
        strokeWidth="1.6"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
      {/* _ underscore */}
      <path
        d="M17 21 H22"
        stroke="hsl(0 0% 100%)"
        strokeWidth="1.6"
        strokeLinecap="square"
      />
    </svg>
  );
}
