/**
 * QR CODE DISPLAY COMPONENT FOR KIOSK
 * 
 * Displays a QR code for the Call to Action feature on the kiosk touch screen.
 * The QR code automatically refreshes when the session changes.
 * 
 * Features:
 * - Automatic QR code generation and refresh
 * - Loading states and error handling
 * - Responsive design for kiosk display
 * - Session change detection
 * - Configurable refresh intervals
 */

"use client";

import type { CachedAvatar } from "@/lib/avatar-storage";

import { useState, useEffect, useCallback } from "react";
import { Card, CardBody } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { RefreshCw, AlertCircle, QrCode } from "lucide-react";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";


interface QRCodeDisplayProps {
  selectedAvatar: CachedAvatar | null;
  sessionId: string | null;
  className?: string;
}

interface QRCodeResponse {
  success: boolean;
  qrCodeDataUrl?: string;
  qrCodeUrl?: string;
  timestamp?: number;
  error?: string;
}

export function QRCodeDisplay({ selectedAvatar, sessionId, className = "" }: QRCodeDisplayProps) {
  const [qrCodeData, setQrCodeData] = useState<QRCodeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGeneratedFor, setLastGeneratedFor] = useState<string>("");

  /**
   * Generate QR Code
   * 
   * Calls the API to generate a new QR code for the current session.
   */
  const generateQRCode = useCallback(async () => {
    if (!selectedAvatar || !sessionId) {
      setQrCodeData(null);
      setError(null);
      return;
    }

    const sessionKey = `${sessionId}-${selectedAvatar.id}`;
    
    // Skip if we already have a QR code for this exact session
    if (lastGeneratedFor === sessionKey && qrCodeData?.success) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/cta/generate-qr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          avatarId: selectedAvatar.id,
          avatarName: selectedAvatar.name,
        }),
      });

      const data: QRCodeResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate QR code");
      }

      if (data.success) {
        setQrCodeData(data);
        setLastGeneratedFor(sessionKey);
        setError(null);
      } else {
        throw new Error(data.error || "QR code generation failed");
      }
    } catch (err) {
      console.error("QR code generation error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate QR code");
      setQrCodeData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedAvatar, sessionId, lastGeneratedFor, qrCodeData?.success]);

  /**
   * Manual Refresh
   * 
   * Force refresh the QR code (for retry on error).
   */
  const handleRefresh = useCallback(() => {
    setLastGeneratedFor(""); // Force regeneration
    generateQRCode();
  }, [generateQRCode]);

  /**
   * Automatic QR Code Generation
   * 
   * Generate QR code when session or avatar changes.
   */
  useEffect(() => {
    generateQRCode();
  }, [generateQRCode]);

  /**
   * No Session State
   * 
   * Show placeholder when no chat session is active.
   */
  if (!selectedAvatar || !sessionId) {
    return (
      <Card className={`bg-white/60 backdrop-blur-md border border-white/80 shadow-lg ${className}`}>
        <CardBody className="flex flex-col items-center justify-center p-6 min-h-[270px]">
          <QrCode className="w-12 h-12 text-gray-400 mb-3" />
          <p className="text-base font-medium text-gray-600 text-center">
            QR code will appear during chat
          </p>
          <p className="text-sm text-gray-500 text-center mt-2">
            Start a conversation to get your connection code
          </p>
        </CardBody>
      </Card>
    );
  }

  /**
   * Loading State
   */
  if (loading) {
    return (
      <Card className={`bg-white/60 backdrop-blur-md border border-white/80 shadow-lg ${className}`}>
        <CardBody className="flex flex-col items-center justify-center p-6 min-h-[270px]">
          <Spinner size="md" color="primary" />
          <p className="text-base font-medium text-gray-600 mt-3">
            Generating QR code...
          </p>
        </CardBody>
      </Card>
    );
  }

  /**
   * Error State
   */
  if (error) {
    return (
      <Card className={`bg-white/60 backdrop-blur-md border border-white/80 shadow-lg ${className}`}>
        <CardBody className="flex flex-col items-center justify-center p-6 min-h-[270px]">
          <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
          <p className="text-base font-medium text-red-600 text-center mb-4">
            Failed to generate QR code
          </p>
          <p className="text-sm text-gray-500 text-center mb-4">
            {error}
          </p>
          <Button
            size="md"
            variant="bordered"
            onPress={handleRefresh}
            startContent={<RefreshCw className="w-4 h-4" />}
          >
            Retry
          </Button>
        </CardBody>
      </Card>
    );
  }

  /**
   * Success State - Display QR Code
   */
  if (qrCodeData?.success && qrCodeData.qrCodeDataUrl) {
    return (
      <Card className={`bg-white/60 backdrop-blur-md border border-white/80 shadow-lg ${className}`}>
        <CardBody className="px-5 py-4">
          {/* Header */}
          <div className="text-center mb-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Scan QR code to connect with Weatherhead
            </h3>
            <p className="text-sm text-gray-600 leading-tight">
              Connect with Weatherhead and get a copy of your conversation
            </p>
          </div>

          {/* QR Code Image */}
          <div className="flex justify-center mb-4">
            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
              <img
                src={qrCodeData.qrCodeDataUrl}
                alt="QR Code to save chat and connect with Weatherhead"
                className="w-48 h-48 block"
                style={{ imageRendering: "pixelated" }} // Crisp QR code rendering
              />
            </div>
          </div>

          {/* Footer Info */}
          <div className="text-center">
            <Chip
              size="md"
              variant="flat"
              color="success"
              className="text-sm font-medium"
            >
              Chat with {selectedAvatar.name}
            </Chip>
            <p className="text-sm text-gray-500 mt-3">
              Scan with your phone camera
            </p>
          </div>

          {/* Refresh Button (Hidden by default, shown on long press or dev mode) */}
          {process.env.NODE_ENV === "development" && (
            <div className="flex justify-center mt-4">
              <Button
                size="md"
                variant="light"
                onPress={handleRefresh}
                startContent={<RefreshCw className="w-4 h-4" />}
                className="text-sm"
              >
                Refresh
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    );
  }

  /**
   * Fallback State
   */
  return (
    <Card className={`bg-white/60 backdrop-blur-md border border-white/80 shadow-lg ${className}`}>
      <CardBody className="flex flex-col items-center justify-center p-6 min-h-[270px]">
        <QrCode className="w-12 h-12 text-gray-400 mb-3" />
        <p className="text-base font-medium text-gray-600 text-center">
          QR code unavailable
        </p>
        <Button
          size="md"
          variant="bordered"
          onPress={handleRefresh}
          startContent={<RefreshCw className="w-4 h-4" />}
          className="mt-3"
        >
          Generate
        </Button>
      </CardBody>
    </Card>
  );
}