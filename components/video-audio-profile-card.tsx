"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { AlertCircle, Video, AudioLines, Globe } from "lucide-react";
import { type CachedVideoAudioProfile, VoiceEmotion } from "@/types";

interface VideoAudioProfileCardProps {
  profile: CachedVideoAudioProfile;
  onClick: (profileId: string) => void;
  isDirty?: boolean;
}

// Helper function to get relative time
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString();
}

// Helper function to format emotion display
function formatEmotion(emotion?: VoiceEmotion): string {
  if (!emotion) return "None";
  return emotion.charAt(0).toUpperCase() + emotion.slice(1);
}

// Helper function to format quality display
function formatQuality(quality: "low" | "medium" | "high"): string {
  return quality.charAt(0).toUpperCase() + quality.slice(1);
}

// Helper function to get quality color
function getQualityColor(quality: "low" | "medium" | "high"): "default" | "warning" | "success" {
  switch (quality) {
    case "high":
      return "success";
    case "medium":
      return "warning";
    default:
      return "default";
  }
}

export default function VideoAudioProfileCard({
  profile,
  onClick,
  isDirty,
}: VideoAudioProfileCardProps) {
  const handleCardClick = () => {
    onClick(profile.id);
  };

  return (
    <Card
      className="h-full cursor-pointer hover:shadow-lg transition-shadow duration-200"
      isPressable
      onPress={handleCardClick}
    >
      <CardHeader className="flex gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100">
          <Video className="w-5 h-5 text-primary-600" />
        </div>
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-md font-semibold">{profile.name}</p>
            <Chip
              size="sm"
              color={getQualityColor(profile.quality)}
              variant="flat"
            >
              {formatQuality(profile.quality)}
            </Chip>
            {(isDirty || profile.isDirty) && (
              <div className="flex items-center gap-1 text-warning">
                <AlertCircle className="w-3 h-3" />
                <span className="text-xs">Unsaved</span>
              </div>
            )}
          </div>
          <p className="flex items-center text-small text-default-500 font-mono">
            {profile.id}
          </p>
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        <div className="space-y-3">
          {/* Description */}
          {profile.description && (
            <div>
              <p className="text-sm text-default-600 line-clamp-2">
                {profile.description}
              </p>
            </div>
          )}

          {/* Video Settings */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-default-400" />
              <span className="text-xs font-medium text-default-500">Video Settings</span>
            </div>
            <div className="pl-6 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-default-500">Avatar:</span>
                <span className="text-xs font-medium font-mono">{profile.avatarName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-default-500">Language:</span>
                <Chip size="sm" variant="flat" startContent={<Globe className="w-3 h-3" />}>
                  {profile.language.toUpperCase()}
                </Chip>
              </div>
            </div>
          </div>

          {/* Audio Settings */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AudioLines className="w-4 h-4 text-default-400" />
              <span className="text-xs font-medium text-default-500">Audio Settings</span>
            </div>
            <div className="pl-6 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-default-500">Rate:</span>
                <span className="text-xs font-medium">{profile.voice.rate}x</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-default-500">Emotion:</span>
                <span className="text-xs font-medium">{formatEmotion(profile.voice.emotion)}</span>
              </div>
            </div>
          </div>

          {/* Creator and editor info */}
          <div className="space-y-2 pt-2 border-t border-default-200">
            <div className="flex items-center gap-2">
              <span className="text-xs text-default-500">Created by:</span>
              <span className="text-xs font-medium">{profile.createdBy}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-default-500">Last edited by:</span>
              <span className="text-xs font-medium">{profile.lastEditedBy}</span>
            </div>
          </div>

          {/* Last edit time */}
          <div className="pt-2 border-t border-default-200">
            <p className="text-xs text-default-400">
              Last edited {getRelativeTime(profile.lastEditedAt)}
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
