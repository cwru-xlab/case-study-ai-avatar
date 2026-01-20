"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import {
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Mail,
  User,
  Send,
  ArrowLeft,
} from "lucide-react";

import type { CTAFormData, QRCodeData } from "@/types";

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
  general?: string;
}

interface SubmissionResponse {
  success: boolean;
  message?: string;
  error?: string;
  submissionId?: string;
}

function CTAFormContent() {
  // URL parameters from QR code
  const searchParams = useSearchParams();

  // Form state
  const [formData, setFormData] = useState<CTAFormData>({
    sessionId: "",
    name: "",
    email: "",
    message: "",
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);

  // Extract QR Code Data from URL Parameters
  useEffect(() => {
    const sessionId = searchParams.get("sessionId");
    const avatarId = searchParams.get("avatarId");
    const avatarName = searchParams.get("avatarName");
    const timestamp = searchParams.get("timestamp");
    const version = searchParams.get("version");

    if (sessionId && avatarId && avatarName && timestamp) {
      const qrCodeData: QRCodeData = {
        sessionId,
        avatarId,
        avatarName,
        timestamp: parseInt(timestamp),
        version: version || "1.0",
      };

      setQrData(qrCodeData);
      setFormData((prev) => ({ ...prev, sessionId }));

      // Validate session exists
      validateSession(sessionId);
    } else {
      setErrors({
        general: "Invalid QR code data. Please scan the QR code again.",
      });
    }
  }, [searchParams]);

  // Validate Chat Session
  const validateSession = async (sessionId: string) => {
    setLoading(true);
    try {
      // Use the new validation endpoint
      const validationData = {
        sessionId,
        avatarId: searchParams.get("avatarId") || "",
        avatarName: searchParams.get("avatarName") || "",
        timestamp: parseInt(searchParams.get("timestamp") || "0"),
        version: searchParams.get("version") || "1.0",
      };

      const response = await fetch("/api/cta/validate-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validationData),
      });

      const result = await response.json();

      if (result.valid) {
        setSessionValid(true);
      } else {
        setSessionValid(false);
        setErrors({
          general:
            result.error ||
            "Chat session not found. The QR code may be expired.",
        });
      }
    } catch (error) {
      setSessionValid(false);
      setErrors({ general: "Unable to validate session. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  // Form Validation
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    } else if (formData.name.trim().length > 100) {
      newErrors.name = "Name must be less than 100 characters";
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid email address";
    } else if (formData.email.trim().length > 255) {
      newErrors.email = "Email must be less than 255 characters";
    }

    // Message validation (optional but limited)
    if (formData.message.trim().length > 500) {
      newErrors.message = "Message must be less than 500 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle Form Input Changes
  const handleInputChange = (field: keyof CTAFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear field-specific errors when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      // Include QR code validation data in the submission
      const submissionData = {
        ...formData,
        qrCodeData: {
          avatarId: searchParams.get("avatarId") || "",
          avatarName: searchParams.get("avatarName") || "",
          timestamp: parseInt(searchParams.get("timestamp") || "0"),
          version: searchParams.get("version") || "1.0",
        },
      };

      const response = await fetch("/api/cta/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionData),
      });

      const result: SubmissionResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Submission failed");
      }

      if (result.success) {
        setSubmitted(true);
      } else {
        throw new Error(result.error || "Submission failed");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Form submission error:", error);
      setErrors({
        general:
          error instanceof Error
            ? error.message
            : "Failed to submit form. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardBody className="flex flex-col items-center justify-center p-8">
            <Spinner size="lg" />
            <p className="mt-4 text-gray-600">Loading...</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Success State
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardBody className="text-center items-center p-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4 dark:text-white">
              Thank You!
            </h1>
            <p className="text-gray-600 mb-6 leading-relaxed dark:text-white">
              We have received your information and will be in touch soon. Check
              your email for confirmation and next steps.
            </p>
            {qrData && (
              <Chip color="success" variant="flat" className="mb-4">
                Chat with {qrData.avatarName} saved
              </Chip>
            )}
            <p className="text-sm text-gray-500 dark:text-white">
              You can safely close this page.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Error State (Invalid Session)
  if (sessionValid === false || (!qrData && !loading)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardBody className="text-center p-8">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-4">
              Invalid QR Code
            </h1>
            <p className="text-gray-600 mb-6">
              {errors.general ||
                "This QR code is invalid or has expired. Please scan a new QR code from the kiosk."}
            </p>
            <Button
              color="primary"
              variant="bordered"
              startContent={<ArrowLeft className="w-4 h-4" />}
              onPress={() => window.history.back()}
            >
              Go Back
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Main Form
  return (
    <>
      {/* Main Content */}
      <div className="max-w-2xl mx-auto p-4 py-8">
        <Card>
          <CardHeader className="text-center pb-4">
            <div className="w-full">
              <MessageSquare className="w-12 h-12 text-blue-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2 dark:text-white">
                Connect with Weatherhead School of Management
              </h2>
              <p className="text-gray-600 leading-relaxed dark:text-white">
                Thank you for chatting with our AI avatar! Please share your
                contact information to continue the conversation and connect
                with our team.
              </p>

              {qrData && (
                <div className="mt-4 flex justify-center">
                  <Chip color="primary" variant="flat">
                    Chat with {qrData.avatarName}
                  </Chip>
                </div>
              )}
            </div>
          </CardHeader>

          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* General Error */}
              {errors.general && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-red-700 text-sm">{errors.general}</p>
                  </div>
                </div>
              )}

              {/* Name Field */}
              <Input
                label="Full Name"
                placeholder="Enter your full name"
                value={formData.name}
                onValueChange={(value) => handleInputChange("name", value)}
                isInvalid={!!errors.name}
                errorMessage={errors.name}
                startContent={<User className="w-4 h-4 text-gray-400" />}
                isRequired
                maxLength={100}
              />

              {/* Email Field */}
              <Input
                label="Email Address"
                placeholder="Enter your email address"
                type="email"
                value={formData.email}
                onValueChange={(value) => handleInputChange("email", value)}
                isInvalid={!!errors.email}
                errorMessage={errors.email}
                startContent={<Mail className="w-4 h-4 text-gray-400" />}
                isRequired
                maxLength={255}
              />

              {/* Message Field */}
              <Textarea
                label="Message (Optional)"
                placeholder="Tell us more about your interests or questions..."
                value={formData.message}
                onValueChange={(value) => handleInputChange("message", value)}
                isInvalid={!!errors.message}
                errorMessage={errors.message}
                maxRows={4}
                maxLength={500}
                description={`${formData.message.length}/500 characters`}
              />

              {/* Submit Button */}
              <Button
                type="submit"
                color="primary"
                size="lg"
                isLoading={submitting}
                startContent={!submitting ? <Send className="w-4 h-4" /> : null}
                className="w-full font-semibold"
                isDisabled={!formData.name.trim() || !formData.email.trim()}
              >
                {submitting ? "Submitting..." : "Submit & Connect"}
              </Button>

              {/* Footer Info */}
              <div className="text-center text-sm text-gray-500 pt-4">
                <p>
                  By submitting this form, you agree to be contacted by the
                  Weatherhead School of Management regarding your inquiry.
                </p>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-gray-600">Loading form...</p>
      </div>
    </div>
  );
}

export default function CTAFormPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CTAFormContent />
    </Suspense>
  );
}
