"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Progress } from "@heroui/progress";
import { Upload, Image as ImageIcon, X, Crop, Trash2 } from "lucide-react";
import { addToast } from "@heroui/toast";
import ReactCrop, { 
  type Crop as ReactCropType, 
  centerCrop, 
  makeAspectCrop,
  convertToPixelCrop
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import AvatarImage from "./AvatarImage";

interface ImageUploadCropProps {
  /** Avatar ID for the upload */
  avatarId: string;
  /** Avatar name for preview */
  avatarName: string;
  /** Current portrait URL if exists */
  currentPortrait?: string;
  /** Callback when image is uploaded successfully */
  onImageUploaded?: (portraitUrl: string) => void;
  /** Callback when image is deleted */
  onImageDeleted?: () => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}

// Crop settings for circular avatar
const ASPECT_RATIO = 1; // 1:1 for square crop
const MIN_DIMENSION = 200;
const MAX_DIMENSION = 2000;

// Robust file extension extraction
const getFileExtension = (file: File): string => {
  // MIME type to extension mapping as fallback
  const mimeToExtension: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg', 
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };

  // First try to get extension from MIME type (most reliable)
  if (file.type && mimeToExtension[file.type]) {
    return mimeToExtension[file.type];
  }

  // Fallback to filename parsing
  const filename = file.name;
  
  // Handle edge cases
  if (!filename || filename === '.' || filename === '..') {
    return 'jpg'; // Default fallback
  }

  // Remove leading dots (handle hidden files like .gitignore)
  const cleanFilename = filename.replace(/^\.+/, '');
  
  // If no filename left after removing leading dots
  if (!cleanFilename) {
    return 'jpg';
  }

  // Find the last dot to get the extension
  const lastDotIndex = cleanFilename.lastIndexOf('.');
  
  // No extension found
  if (lastDotIndex === -1 || lastDotIndex === cleanFilename.length - 1) {
    return 'jpg';
  }

  // Extract and normalize extension
  const extension = cleanFilename.substring(lastDotIndex + 1).toLowerCase();
  
  // Validate extension against allowed types
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  if (allowedExtensions.includes(extension)) {
    // Normalize jpeg to jpg for consistency
    return extension === 'jpeg' ? 'jpg' : extension;
  }

  // Return default if extension is not in allowed list
  return 'jpg';
};

/**
 * Image Upload with Crop Component
 * 
 * Provides a complete image upload experience with cropping functionality.
 * Supports drag-and-drop, file validation, circular crop preview, and upload progress.
 */
export default function ImageUploadCrop({
  avatarId,
  avatarName,
  currentPortrait,
  onImageUploaded,
  onImageDeleted,
  disabled = false
}: ImageUploadCropProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string>("");
  const [crop, setCrop] = useState<ReactCropType>();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // File validation
  const validateFile = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      return 'Only JPEG and PNG images are allowed.';
    }

    if (file.size > maxSize) {
      return 'File size must be less than 5MB.';
    }

    return null;
  };

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      addToast({
        title: "Invalid File",
        description: error,
        color: "danger",
      });
      return;
    }

    setSelectedFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      setImageSrc(imageUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && files[0]) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // Initialize crop when image loads and validate dimensions
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
    
    // Validate dimensions
    if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
      addToast({
        title: "Image Too Small",
        description: `Image dimensions must be at least ${MIN_DIMENSION}x${MIN_DIMENSION} pixels.`,
        color: "danger",
      });
      handleCancel();
      return;
    }

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      addToast({
        title: "Image Too Large",
        description: `Image dimensions must be no more than ${MAX_DIMENSION}x${MAX_DIMENSION} pixels.`,
        color: "danger",
      });
      handleCancel();
      return;
    }
    
    const crop = makeAspectCrop(
      {
        unit: '%',
        width: 80, // Start with 80% of the image
      },
      ASPECT_RATIO,
      width,
      height
    );
    
    const centeredCrop = centerCrop(crop, width, height);
    setCrop(centeredCrop);
  }, []);

  // Create cropped image canvas
  const createCroppedImage = useCallback(async (): Promise<File | null> => {
    if (!imageRef.current || !crop || !canvasRef.current || !selectedFile) {
      return null;
    }

    const image = imageRef.current;
    const canvas = canvasRef.current;
    const pixelCrop = convertToPixelCrop(crop, image.naturalWidth, image.naturalHeight);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Set canvas size to crop dimensions
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // Draw the cropped image
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    // Convert canvas to blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const fileExtension = getFileExtension(selectedFile);
          const croppedFile = new File(
            [blob], 
            `avatar-${avatarId}.${fileExtension}`, 
            { type: blob.type }
          );
          resolve(croppedFile);
        } else {
          resolve(null);
        }
      }, selectedFile.type);
    });
  }, [crop, selectedFile, avatarId]);

  // Upload cropped image
  const handleUpload = async () => {
    if (!selectedFile || !crop) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Create cropped image
      setUploadProgress(20);
      const croppedFile = await createCroppedImage();
      
      if (!croppedFile) {
        throw new Error('Failed to create cropped image');
      }

      setUploadProgress(40);

      // Upload to server
      const formData = new FormData();
      formData.append('file', croppedFile);
      formData.append('avatarId', avatarId);

      setUploadProgress(60);

      const response = await fetch('/api/avatar/upload-image', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(80);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      setUploadProgress(100);

      // Clear the crop interface
      setSelectedFile(null);
      setImageSrc("");
      setCrop(undefined);

      // Notify parent component
      if (onImageUploaded) {
        onImageUploaded(result.portraitUrl);
      }

      addToast({
        title: "Image Uploaded",
        description: "Avatar image updated successfully!",
        color: "success",
      });

    } catch (error) {
      console.error('Upload error:', error);
      addToast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        color: "danger",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Delete current image
  const handleDelete = async () => {
    if (!currentPortrait) return;

    setIsUploading(true);

    try {
      const response = await fetch(`/api/avatar/upload-image?avatarId=${avatarId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }

      // Notify parent component
      if (onImageDeleted) {
        onImageDeleted();
      }

      addToast({
        title: "Image Deleted",
        description: "Avatar image removed successfully!",
        color: "success",
      });

    } catch (error) {
      console.error('Delete error:', error);
      addToast({
        title: "Delete Failed", 
        description: error instanceof Error ? error.message : "Failed to delete image",
        color: "danger",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Cancel crop
  const handleCancel = () => {
    setSelectedFile(null);
    setImageSrc("");
    setCrop(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="w-full">
      <CardBody className="space-y-4">
        {/* Current Avatar Preview */}
        <div className="flex items-center gap-4">
          <AvatarImage 
            name={avatarName}
            portrait={currentPortrait}
            size={64}
            alt={`${avatarName} current avatar`}
          />
          <div className="flex-1">
            <h4 className="font-medium">Current Avatar Image</h4>
            <p className="text-sm text-default-500">
              {currentPortrait ? 'Custom image uploaded' : 'Using generated avatar'}
            </p>
          </div>
          {currentPortrait && (
            <Button
              color="danger"
              variant="bordered"
              size="sm"
              startContent={<Trash2 size={16} />}
              onPress={handleDelete}
              isDisabled={disabled || isUploading}
              isLoading={isUploading}
            >
              Delete
            </Button>
          )}
        </div>

        {/* Upload Interface */}
        {!imageSrc ? (
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/10"
                : "border-default-300 hover:border-default-400"
            } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <ImageIcon className="mx-auto mb-4 text-default-400" size={48} />
            <p className="text-lg font-medium mb-2">
              Upload new avatar image
            </p>
            <p className="text-sm text-default-500 mb-4">
              Drop an image here or click to upload<br />
              Supported formats: JPEG, PNG (max 5MB)
            </p>
            <Button
              color="primary"
              variant="flat"
              startContent={<Upload size={16} />}
              onPress={() => fileInputRef.current?.click()}
              isDisabled={disabled}
            >
              Choose Image
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
            />
          </div>
        ) : (
          /* Crop Interface */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <Crop size={16} />
                Crop Your Image
              </h4>
              <p className="text-sm text-default-500">
                Adjust the crop area for your avatar
              </p>
            </div>

            <div className="relative">
              <ReactCrop
                crop={crop}
                onChange={(newCrop) => setCrop(newCrop)}
                aspect={ASPECT_RATIO}
                minWidth={MIN_DIMENSION}
                minHeight={MIN_DIMENSION}
                circularCrop
                className="max-w-full mx-auto"
              >
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Crop preview"
                  className="max-w-full h-auto"
                  onLoad={handleImageLoad}
                />
              </ReactCrop>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <Progress
                color="primary"
                value={uploadProgress}
                className="w-full"
                label="Uploading image..."
              />
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <Button
                variant="bordered"
                onPress={handleCancel}
                isDisabled={isUploading}
              >
                <X size={16} />
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleUpload}
                isDisabled={!crop || isUploading}
                isLoading={isUploading}
                startContent={!isUploading ? <Upload size={16} /> : null}
              >
                {isUploading ? 'Uploading...' : 'Upload Image'}
              </Button>
            </div>
          </div>
        )}

        {/* Hidden canvas for image processing */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </CardBody>
    </Card>
  );
}