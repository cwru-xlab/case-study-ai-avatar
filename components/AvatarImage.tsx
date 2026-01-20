"use client";

import { useState } from "react";
import Image from "next/image";
import BoringAvatar from "boring-avatars";

interface AvatarImageProps {
  /** Avatar name for fallback generation */
  name: string;
  /** Custom portrait URL (optional) */
  portrait?: string;
  /** Size of the avatar */
  size: number;
  /** Additional CSS classes */
  className?: string;
  /** Alt text for accessibility */
  alt?: string;
}

/**
 * Shared Avatar Image Component with Fallback
 *
 * Displays custom portrait images when available, falls back to boring-avatars
 * when no custom image is provided. Handles loading states and errors gracefully.
 */
export default function AvatarImage({
  name,
  portrait,
  size,
  className = "",
  alt,
}: AvatarImageProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(!!portrait);

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  const imageLoader = ({ src, width, quality }: { src: string; width: number; quality?: number }) => {
    return `${src}?w=${width}&q=${quality || 75}`;
  };

  // Use boring-avatars if no portrait, image failed to load, or while loading
  const shouldUseFallback = !portrait || imageError;

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
    >
      {shouldUseFallback ? (
        <BoringAvatar name={name} size={size} />
      ) : (
        <>
          {/* Loading placeholder - show boring avatar while custom image loads */}
          {imageLoading && (
            <div className="absolute inset-0">
              <BoringAvatar name={name} size={size} />
            </div>
          )}

          {/* Custom portrait image */}
          <Image
            loader={imageLoader}
            src={portrait}
            alt={alt || `${name} avatar`}
            width={size}
            height={size}
            className={`rounded-full object-cover ${imageLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{
              width: size,
              height: size,
              minWidth: size,
              minHeight: size,
            }}
          />
        </>
      )}
    </div>
  );
}
