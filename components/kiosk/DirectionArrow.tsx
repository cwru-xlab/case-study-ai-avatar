"use client";

import { HTMLAttributes } from "react";

interface DirectionArrowProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Rotation angle in degrees (e.g., 0 = right, 90 = down, 180 = left, 270 = up)
   */
  rotation?: number;
  /**
   * Size of the arrow in rem units
   */
  size?: number;
  /**
   * Color of the arrow (CSS color value)
   */
  color?: string;
  /**
   * Glow color (CSS color value)
   */
  glowColor?: string;
}

/**
 * DirectionArrow - An animated, glowing arrow component for guiding user attention
 */
export function DirectionArrow({
  rotation = 0,
  size = 7,
  color = "rgb(107, 114, 128)", // gray-500
  glowColor = "rgba(59, 130, 246, 0.6)", // blue-500 with opacity
  className = "",
  ...props
}: DirectionArrowProps) {
  return (
    <div
      className={`inline-block ${className}`}
      style={{
        transform: `rotate(${rotation}deg)`,
      }}
      {...props}
    >
      <style>{`
        @keyframes arrowPulse {
          0%,
          100% {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
          50% {
            transform: translateX(12px) scale(1.05);
            opacity: 0.9;
          }
        }

        @keyframes glowPulse {
          0%,
          100% {
            filter: drop-shadow(0 0 8px ${glowColor})
              drop-shadow(0 0 16px ${glowColor})
              drop-shadow(0 0 24px ${glowColor});
          }
          50% {
            filter: drop-shadow(0 0 12px ${glowColor})
              drop-shadow(0 0 24px ${glowColor})
              drop-shadow(0 0 32px ${glowColor});
          }
        }

        .animated-arrow {
          animation: arrowPulse 2s ease-in-out infinite,
            glowPulse 2s ease-in-out infinite;
        }
      `}</style>
      <div
        className="animated-arrow font-bold"
        style={{
          fontSize: `${size}rem`,
          color: color,
        }}
      >
        →
      </div>
    </div>
  );
}

