"use client";

interface AnimatedBackgroundProps {
  showRainbowHalo?: boolean;
}

export const AnimatedBackground = ({
  showRainbowHalo = false,
}: AnimatedBackgroundProps) => (
  <div className="absolute inset-0">
    {/* Rainbow Halo Border Layer (bottom layer when enabled) */}
    {showRainbowHalo && (
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(45deg, #ff0080, #ff8c00, #40e0d0, #ff0080)",
          backgroundSize: "400% 400%",
          animation: "rainbowHalo 8s ease-in-out infinite",
        }}
      ></div>
    )}

    {/* Original Background Layer (top layer with rounded corners) */}
    <div
      className={`absolute ${showRainbowHalo ? "inset-2 rounded-3xl" : "inset-0"} bg-gradient-to-br from-purple-100 via-blue-50 to-indigo-100`}
    >
      {/* Animated Gradient Overlay 1 */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-100/30 via-purple-50/20 to-pink-100/30 animate-pulse"></div>

      {/* Animated Gradient Overlay 2 */}
      <div
        className="absolute inset-0 opacity-25 rounded-3xl"
        style={{
          background:
            "linear-gradient(45deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1), rgba(236, 72, 153, 0.1), rgba(34, 197, 94, 0.1))",
          backgroundSize: "400% 400%",
          animation: "gradientShift 15s ease-in-out infinite",
        }}
      ></div>

      {/* Floating Orbs */}
      <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-cyan-100/20 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute top-3/4 right-1/4 w-48 h-48 bg-purple-100/20 rounded-full blur-xl animate-pulse"></div>
      <div className="absolute bottom-1/4 left-1/3 w-24 h-24 bg-pink-100/20 rounded-full blur-xl animate-ping"></div>

      {/* Mesh Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-3 rounded-3xl"
        style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 1px, transparent 1px),
                           radial-gradient(circle at 75% 75%, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      ></div>
    </div>

    {/* CSS Animation Keyframes */}
    <style>{`
      @keyframes gradientShift {
        0% {
          background-position: 0% 50%;
        }
        50% {
          background-position: 100% 50%;
        }
        100% {
          background-position: 0% 50%;
        }
      }
      
      @keyframes rainbowHalo {
        0% {
          background-position: 0% 50%;
        }
        50% {
          background-position: 100% 50%;
        }
        100% {
          background-position: 0% 50%;
        }
      }
    `}</style>
  </div>
);
