"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface SpecialEventOverlayProps {
  /** Image source URL to display */
  imageSrc?: string;
  /** Text to display on the right side of the overlay */
  text?: string;
  /** How often the overlay appears (in seconds) */
  intervalSeconds?: number;
  /** How long the overlay stays visible (in seconds) */
  displayDurationSeconds?: number;
  /** Border/progress bar width in pixels */
  borderWidth?: number;
  /** Border/progress bar color */
  borderColor?: string;
  /** Corner radius for the image (in pixels) */
  cornerRadius?: number;
}

export default function SpecialEventOverlay({
  imageSrc = "/12345.png",
  text = "Use the touch screen to start chatting now!",
  intervalSeconds = 60,
  displayDurationSeconds = 15,
  borderWidth = 8,
  borderColor = "#3b82f6", // blue-500
  cornerRadius = 24,
}: SpecialEventOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  // Load image and calculate aspect ratio
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      setAspectRatio(ratio);
    };
    img.onerror = () => {
      console.error("Failed to load image for aspect ratio calculation");
      setAspectRatio(1); // Fallback to square
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    // Don't start interval until aspect ratio is loaded
    if (!aspectRatio) return;

    // Function to show the overlay and animate progress
    const showOverlay = () => {
      setIsVisible(true);
      setIsAnimatingOut(false);
      setProgress(0);

      // Animate progress from 0 to 100 over the display duration
      const startTime = Date.now();
      const animationInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progressPercent = Math.min(
          (elapsed / (displayDurationSeconds * 1000)) * 100,
          100
        );
        setProgress(progressPercent);

        if (progressPercent >= 100) {
          clearInterval(animationInterval);
          // Start exit animation
          setIsAnimatingOut(true);
          // Wait for animation to complete before hiding
          setTimeout(() => {
            setIsVisible(false);
            setIsAnimatingOut(false);
          }, 400); // Match animation duration
        }
      }, 16); // ~60fps

      // Cleanup interval when done
      return () => clearInterval(animationInterval);
    };

    // Show immediately on mount (optional - remove if you want to wait for first interval)
    // showOverlay();

    // Set up the recurring interval
    const recurringInterval = setInterval(() => {
      showOverlay();
    }, intervalSeconds * 1000);

    // Cleanup on unmount
    return () => {
      clearInterval(recurringInterval);
    };
  }, [intervalSeconds, displayDurationSeconds, aspectRatio]);

  if (!isVisible || !aspectRatio) {
    return null;
  }

  // Calculate dimensions - 90vh height, width based on aspect ratio
  const heightVh = 90; // 90% of viewport height
  const padding = borderWidth * 2 + 20; // Padding for border and spacing

  // Calculate container dimensions (will be set via CSS)
  const imageHeight = `${heightVh}vh`;
  const imageWidth = `calc(${heightVh}vh * ${aspectRatio})`;
  const containerWidth = `calc(${heightVh}vh * ${aspectRatio} + ${padding}px)`;
  const containerHeight = `calc(${heightVh}vh + ${padding}px)`;

  // For SVG path calculation, we need approximate pixel values
  // Using 1vh ≈ window.innerHeight / 100
  const approxHeight =
    (typeof window !== "undefined" ? window.innerHeight : 1080) *
    (heightVh / 100);
  const approxWidth = approxHeight * aspectRatio;
  const svgWidth = approxWidth + padding;
  const svgHeight = approxHeight + padding;

  // Rounded rectangle path
  const x = padding / 2;
  const y = padding / 2;
  const width = approxWidth;
  const height = approxHeight;
  const r = cornerRadius;

  // Create a rounded rectangle path
  const rectPath = `
    M ${x + r} ${y}
    L ${x + width - r} ${y}
    Q ${x + width} ${y} ${x + width} ${y + r}
    L ${x + width} ${y + height - r}
    Q ${x + width} ${y + height} ${x + width - r} ${y + height}
    L ${x + r} ${y + height}
    Q ${x} ${y + height} ${x} ${y + height - r}
    L ${x} ${y + r}
    Q ${x} ${y} ${x + r} ${y}
    Z
  `;

  // Calculate path length (approximate for rounded rectangle)
  const pathLength = 2 * (width + height) - 8 * r + 2 * Math.PI * r;
  const strokeDashoffset = pathLength - (progress / 100) * pathLength;

  // Keyframe animations for appear effect
  const animations = `
    @keyframes overlayFadeIn {
      from {
        opacity: 0;
        backdrop-filter: blur(0px);
      }
      to {
        opacity: 1;
        backdrop-filter: blur(8px);
      }
    }
    
    @keyframes overlaySlideUp {
      from {
        opacity: 0;
        transform: translateY(30px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `;

  return (
    <>
      <style>{animations}</style>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(8px)",
          animation: isAnimatingOut ? "none" : "overlayFadeIn 0.4s ease-out",
          opacity: isAnimatingOut ? 0 : 1,
          transition: isAnimatingOut
            ? "opacity 0.4s ease-in, backdrop-filter 0.4s ease-in"
            : "none",
        }}
      >
        <div className="flex items-center gap-12">
          <div
            className="relative"
            style={{
              width: containerWidth,
              height: containerHeight,
              animation: isAnimatingOut
                ? "none"
                : "overlaySlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
              transform: isAnimatingOut
                ? "scale(0.9) translateY(-20px)"
                : "scale(1) translateY(0)",
              opacity: isAnimatingOut ? 0 : 1,
              transition: isAnimatingOut ? "all 0.4s ease-in" : "none",
            }}
          >
            {/* SVG for rounded rectangle progress border */}
            <svg
              className="absolute top-0 left-0 w-full h-full"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Background path (shows full border outline) */}
              <path
                d={rectPath}
                fill="none"
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth={borderWidth}
              />

              {/* Animated progress path */}
              <path
                d={rectPath}
                fill="none"
                stroke={borderColor}
                strokeWidth={borderWidth}
                strokeLinecap="round"
                strokeDasharray={pathLength}
                strokeDashoffset={strokeDashoffset}
                style={{
                  transition: "stroke-dashoffset 0.1s linear",
                }}
              />
            </svg>

            {/* Image with rounded corners */}
            <div
              className="absolute"
              style={{
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: imageWidth,
                height: imageHeight,
              }}
            >
              <div
                className="relative w-full h-full overflow-hidden bg-white shadow-2xl"
                style={{
                  borderRadius: cornerRadius,
                }}
              >
                <Image
                  src={imageSrc}
                  alt="Special Event"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Text on the right side */}
          {text && (
            <div
              className="text-white text-6xl font-bold max-w-md leading-tight"
              style={{
                animation: isAnimatingOut
                  ? "none"
                  : "overlaySlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s backwards",
                transform: isAnimatingOut
                  ? "scale(0.9) translateY(-20px)"
                  : "scale(1) translateY(0)",
                opacity: isAnimatingOut ? 0 : 1,
                transition: isAnimatingOut ? "all 0.4s ease-in" : "none",
                textShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
              }}
            >
              {text}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
