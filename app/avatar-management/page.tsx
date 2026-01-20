"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Plus, RefreshCw } from "lucide-react";
import { title } from "@/components/primitives";
import AvatarCard from "@/components/avatar-card";
import { avatarStorage, type CachedAvatar } from "@/lib/avatar-storage";

export default function AvatarManagementPage() {
  const router = useRouter();
  const [avatars, setAvatars] = useState<CachedAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load avatars on component mount
  useEffect(() => {
    loadAvatars();
  }, []);

  const loadAvatars = async () => {
    try {
      setLoading(true);
      setError(null);
      const avatarList = await avatarStorage.list();
      setAvatars(avatarList);
    } catch (err) {
      console.error("Failed to load avatars:", err);
      setError("Failed to load avatars");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const avatarList = await avatarStorage.list();
      setAvatars(avatarList);
    } catch (err) {
      console.error("Failed to sync avatars:", err);
      setError("Failed to sync avatars");
    } finally {
      setSyncing(false);
    }
  };

  const handleAvatarClick = (avatarId: string) => {
    router.push(`/avatar-management/edit/${avatarId}`);
  };

  const handleAddAvatar = () => {
    router.push("/avatar-management/edit/new");
  };

  return (
    <div className="space-y-6">
      {/* Header with title and buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className={title()}>Avatar Management</h1>
        <div className="flex gap-2">
          <Button
            variant="bordered"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={handleSync}
            isLoading={syncing}
            className="self-start sm:self-auto"
          >
            {syncing ? "Syncing..." : "Sync"}
          </Button>
          <Button
            color="primary"
            variant="solid"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleAddAvatar}
            className="self-start sm:self-auto"
          >
            Add Avatar
          </Button>
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
          <p className="text-default-500">Loading avatars...</p>
        </div>
      )}

      {/* Avatars grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {avatars.map((avatar) => (
            <AvatarCard
              key={avatar.id}
              avatar={avatar}
              onClick={handleAvatarClick}
              isDirty={avatar.isDirty}
            />
          ))}
        </div>
      )}

      {/* Empty state if no avatars */}
      {!loading && avatars.length === 0 && (
        <div className="text-center py-12">
          <p className="text-default-500 mb-4">No avatars found</p>
          <Button
            color="primary"
            variant="bordered"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleAddAvatar}
          >
            Create your first avatar
          </Button>
        </div>
      )}
    </div>
  );
}
