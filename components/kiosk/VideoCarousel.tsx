"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardBody } from "@heroui/card";
import type { Avatar } from "@/lib/avatar-storage";

export interface VideoItem {
  videoSrc: string;
  avatarId: string;
}

interface VideoCarouselProps {
  videos?: VideoItem[];
  onActiveChange?: (activeVideo: VideoItem | null, activeAvatar: Avatar | null, activeIndex: number) => void;
}

// Add CSS animation for slide down effect
const slideDownStyles = `
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

export default function VideoCarousel({
  videos = [
    { videoSrc: "/idle-carousel-1.mp4", avatarId: "john-paul-stephens" },
    { videoSrc: "/idle-carousel-2.mp4", avatarId: "jenny-hawkins" },
    { videoSrc: "/idle-carousel-3.mp4", avatarId: "michael-goldberg" },
    { videoSrc: "/idle-carousel-4.mp4", avatarId: "richard-boyatzis" },
    { videoSrc: "/idle-carousel-5.mp4", avatarId: "scott-cowen" },
  ],
  onActiveChange,
}: VideoCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [avatars, setAvatars] = useState<Record<string, Avatar>>({});

  // Load avatars from localStorage (shared by touch screen)
  useEffect(() => {
    const loadAvatarsFromStorage = () => {
      try {
        const storedAvatars = localStorage.getItem("kioskPublishedAvatars");
        if (storedAvatars) {
          const publishedAvatars = JSON.parse(storedAvatars) as Avatar[];
          const avatarMap: Record<string, Avatar> = {};
          
          // Map avatars by ID for quick lookup
          publishedAvatars.forEach((avatar) => {
            avatarMap[avatar.id] = avatar;
          });
          
          setAvatars(avatarMap);
        }
      } catch (error) {
        console.error("Failed to load avatars from localStorage:", error);
      }
    };

    // Load initially
    loadAvatarsFromStorage();

    // Listen for storage changes from touch screen
    const handleStorageChange = () => {
      loadAvatarsFromStorage();
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Handle video end event - auto advance to next video
  const handleVideoEnd = () => {
    if (!isTransitioning) {
      setIsTransitioning(true);
      // Move to next video (loop back to start if at end)
      setActiveIndex((prev) => (prev + 1) % videos.length);
      setTimeout(() => setIsTransitioning(false), 600); // Match transition duration
    }
  };

  // Play/pause videos based on active index
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (video) {
        if (index === activeIndex) {
          // Play the active video
          video.currentTime = 0; // Start from beginning
          video.play().catch((err) => {
            console.error("Error playing video:", err);
          });
        } else {
          // Pause inactive videos
          video.pause();
        }
      }
    });
  }, [activeIndex]);

  // Manual navigation
  const goToPrevious = () => {
    if (!isTransitioning) {
      setIsTransitioning(true);
      setActiveIndex((prev) => (prev - 1 + videos.length) % videos.length);
      setTimeout(() => setIsTransitioning(false), 600);
    }
  };

  const goToNext = () => {
    if (!isTransitioning) {
      setIsTransitioning(true);
      setActiveIndex((prev) => (prev + 1) % videos.length);
      setTimeout(() => setIsTransitioning(false), 600);
    }
  };

  // Get active avatar info
  const activeVideo = videos[activeIndex];
  const activeAvatar = activeVideo ? avatars[activeVideo.avatarId] : null;

  // Notify parent of active changes
  useEffect(() => {
    if (onActiveChange) {
      onActiveChange(activeVideo, activeAvatar, activeIndex);
    }
  }, [activeIndex, activeVideo, activeAvatar, onActiveChange]);

  return (
    <>
      <style>{slideDownStyles}</style>
      <div className="w-full max-w-5xl mx-1 mb-32 px-0 py-1">
        <div className="relative">
        {/* Carousel Container */}
        <div className="relative h-[800px] flex items-center justify-center overflow-hidden">
          {/* Videos */}
          <div className="relative w-full h-full flex items-center justify-center pb-10">
            {videos.map((video, index) => {
              const isActive = index === activeIndex;
              
              // Calculate offset - active is 0, videos ahead are 1, 2, 3...
              const offset = index - activeIndex;
              
              // Normalize offset to handle wrap-around
              let normalizedOffset = offset;
              if (offset < 0) {
                normalizedOffset = offset + videos.length;
              }

              // Calculate position
              let translateX = 0;
              let translateY = 0;
              let rotate = 0;
              let scale = 1;
              let opacity = 1;
              let zIndex = 0;
              let blur = 0;

              if (normalizedOffset === 0) {
                // Active video - positioned on the RIGHT
                translateX = 35; // Move to right side
                scale = 1;
                opacity = 1;
                zIndex = 30;
                blur = 0;
                rotate = 0;
              } else {
                // Queue videos - fanned out on the LEFT
                // Position them with reduced spacing and fan rotation
                translateX = -30 - (normalizedOffset - 1) * 8; // Reduced spacing between cards
                translateY = (normalizedOffset - 1) * 4; // Slight vertical offset for fan effect
                rotate = (normalizedOffset - 1) * -3; // Fan rotation (negative = counter-clockwise)
                scale = 0.85; // Smaller size difference
                opacity = 1; // Not transparent
                zIndex = 25 - normalizedOffset; // Stack order (closer to active = higher z)
                blur = 3;
              }

              return (
                <div
                  key={index}
                  className="absolute transition-all duration-500 ease-in-out"
                  style={{
                    transform: `translateX(${translateX}%) translateY(${translateY}%) rotate(${rotate}deg) scale(${scale})`,
                    opacity: opacity,
                    zIndex: zIndex,
                    filter: `blur(${blur}px)`,
                    pointerEvents: isActive ? "auto" : "none",
                  }}
                >
                  <Card
                    className="shadow-xl bg-white/90 backdrop-blur-md overflow-hidden"
                    style={{
                      width: "490px",
                      height: "740px",
                    }}
                  >
                    <CardBody className="p-0 overflow-hidden">
                      <video
                        ref={(el) => {
                          videoRefs.current[index] = el;
                        }}
                        src={video.videoSrc}
                        className="w-full h-full object-cover"
                        onEnded={isActive ? handleVideoEnd : undefined}
                        playsInline
                        muted
                        preload="auto"
                      />
                    </CardBody>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Navigation Buttons */}
          {/* <button
            onClick={goToPrevious}
            disabled={isTransitioning}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-40 bg-white/80 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed rounded-full p-3 shadow-xl transition-all duration-200 hover:scale-110"
            aria-label="Previous video"
          >
            <ChevronLeft className="w-8 h-8 text-gray-800" />
          </button>

          <button
            onClick={goToNext}
            disabled={isTransitioning}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-40 bg-white/80 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed rounded-full p-3 shadow-xl transition-all duration-200 hover:scale-110"
            aria-label="Next video"
          >
            <ChevronRight className="w-8 h-8 text-gray-800" />
          </button> */}

          {/* Indicator Dots */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex justify-center gap-3 z-40">
            {videos.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  if (!isTransitioning && index !== activeIndex) {
                    setIsTransitioning(true);
                    setActiveIndex(index);
                    setTimeout(() => setIsTransitioning(false), 600);
                  }
                }}
                className={`rounded-full transition-all duration-300 ${
                  index === activeIndex
                    ? "w-12 h-3 bg-linear-to-r from-blue-300 via-indigo-300 to-pink-300"
                    : "w-3 h-3 bg-gray-400 hover:bg-gray-600"
                }`}
                aria-label={`Go to video ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

// Avatar Introduction Component - to be used separately in layout
interface AvatarIntroductionProps {
  activeVideo: VideoItem | null;
  activeAvatar: Avatar | null;
  activeIndex: number;
}

export function AvatarIntroduction({ 
  activeVideo, 
  activeAvatar, 
  activeIndex 
}: AvatarIntroductionProps) {
  return (
    <>
      <style>{slideDownStyles}</style>
      <div className="w-full max-w-3xl relative">
        {activeAvatar ? (
          <div className="relative">
            {/* Speech Bubble */}
            <div className="bg-white rounded-3xl shadow-2xl p-8 border-4 border-blue-300 relative">
              {/* Pointer Arrow pointing to the left (towards video) */}
              <div className="absolute left-[-26px] top-1/3 -translate-x-full">
                <div className="relative w-0 h-0">
                  {/* Outer arrow (border) */}
                  <div className="absolute top-0 left-0 w-0 h-0 
                    border-t-20 border-t-transparent 
                    border-b-20 border-b-transparent 
                    border-r-30 border-r-blue-300"
                    style={{ transform: 'translateX(-4px)' }}
                  ></div>
                  {/* Inner arrow (white fill) - extends into bubble to cover border */}
                  <div className="absolute top-0 left-0 w-0 h-0 
                    border-t-16 border-t-transparent 
                    border-b-16 border-b-transparent 
                    border-r-28 border-r-white"
                    style={{ transform: 'translate(2px, 4px)', zIndex: 10 }}
                  ></div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Greeting - Slide down animation */}
                <div
                  key={`greeting-${activeIndex}`}
                  className="animate-slideDown opacity-0"
                  style={{
                    animation: "slideDown 0.6s ease-out 0.1s forwards",
                  }}
                >
                  <h2 className="text-5xl font-bold text-gray-800">
                    Hi, I am {activeAvatar.name}
                  </h2>
                  {activeAvatar.title && (
                    <p className="text-2xl text-gray-600 mt-2">{activeAvatar.title}</p>
                  )}
                </div>

                {/* Talk to me about - Slide down animation */}
                <div
                  key={`talk-${activeIndex}`}
                  className="animate-slideDown opacity-0"
                  style={{
                    animation: "slideDown 0.6s ease-out 0.3s forwards",
                  }}
                >
                  <h3 className="text-3xl font-semibold text-gray-700">
                    Talk to me about:
                  </h3>
                </div>

                {/* Conversation Starters - Staggered slide down */}
                <div className="space-y-3">
                  {activeAvatar.conversationStarters?.map((starter, idx) => (
                    <div
                      key={`${activeIndex}-starter-${idx}`}
                      className="animate-slideDown opacity-0"
                      style={{
                        animation: `slideDown 0.6s ease-out ${0.5 + idx * 0.15}s forwards`,
                      }}
                    >
                      <div className="bg-linear-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                        <p className="text-3xl font-medium text-gray-800">
                          {starter.title}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32">
            <p className="text-gray-400 text-2xl">Loading avatar info...</p>
          </div>
        )}
      </div>
    </>
  );
}
