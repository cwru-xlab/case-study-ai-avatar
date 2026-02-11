"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Plus, RefreshCw, Video, AudioLines } from "lucide-react";
import { title } from "@/components/primitives";
import VideoAudioProfileCard from "@/components/video-audio-profile-card";
import {
  videoAudioProfileStorage,
  DEFAULT_PROFILE_CONFIG,
} from "@/lib/video-audio-profile-storage";
import { type CachedVideoAudioProfile } from "@/types";
import { useAuth } from "@/lib/auth-context";

export default function AvatarProfilesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<CachedVideoAudioProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load profiles on component mount
  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const profileList = await videoAudioProfileStorage.list();
      setProfiles(profileList);
    } catch (err) {
      console.error("Failed to load profiles:", err);
      setError("Failed to load avatar profiles");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadProfiles();
  };

  const handleProfileClick = (profileId: string) => {
    router.push(`/avatar-profiles/edit/${profileId}`);
  };

  const handleAddProfile = () => {
    router.push("/avatar-profiles/edit/new");
  };

  return (
    <div className="space-y-6">
      {/* Header with title and buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100">
            <Video className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className={title()}>Avatar Profiles</h1>
            <p className="text-sm text-default-500 mt-1">
              Manage video and audio configurations for your avatars
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="bordered"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={handleRefresh}
            isLoading={loading}
            className="self-start sm:self-auto"
          >
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button
            color="primary"
            variant="solid"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleAddProfile}
            className="self-start sm:self-auto"
          >
            Add Profile
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary-600" />
            <AudioLines className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h3 className="font-medium text-primary-800">
              What are Avatar Profiles?
            </h3>
            <p className="text-sm text-primary-700 mt-1">
              Avatar profiles define the video and audio settings for your AI avatars.
              This includes the HeyGen avatar model, video quality, voice settings,
              speech rate, and emotion. Create and manage profiles here, then assign
              them to your avatars.
            </p>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12">
          <p className="text-default-500">Loading avatar profiles...</p>
        </div>
      )}

      {/* Profiles grid */}
      {!loading && profiles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {profiles.map((profile) => (
            <VideoAudioProfileCard
              key={profile.id}
              profile={profile}
              onClick={handleProfileClick}
              isDirty={profile.isDirty}
            />
          ))}
        </div>
      )}

      {/* Empty state if no profiles */}
      {!loading && profiles.length === 0 && (
        <div className="text-center py-12 space-y-4">
          <div className="flex justify-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-default-100">
              <Video className="w-8 h-8 text-default-400" />
            </div>
          </div>
          <div>
            <p className="text-default-500 mb-2">No avatar profiles found</p>
            <p className="text-sm text-default-400">
              Create your first profile to define video and audio settings for your avatars
            </p>
          </div>
          <Button
            color="primary"
            variant="bordered"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleAddProfile}
          >
            Create your first profile
          </Button>
        </div>
      )}
    </div>
  );
}
