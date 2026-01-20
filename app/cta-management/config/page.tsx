
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input, Textarea } from "@heroui/input";
import { Switch } from "@heroui/switch";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Divider } from "@heroui/divider";
import { 
  ArrowLeft, 
  Save, 
  RefreshCw, 
  Mail, 
  Settings, 
  MessageSquare,
  Globe,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { title } from "@/components/primitives";
import type { CTAConfig } from "@/types";

export default function CTAConfigurationPage() {
  const router = useRouter();

  // Configuration state
  const [config, setConfig] = useState<CTAConfig | null>(null);
  const [formData, setFormData] = useState<Partial<CTAConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Email recipients management
  const [newEmailRecipient, setNewEmailRecipient] = useState("");

  // Load Configuration
  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/cta/config");
      
      if (!response.ok) {
        throw new Error("Failed to load configuration");
      }

      const data = await response.json();
      
      if (data.success) {
        setConfig(data.config);
        setFormData(data.config);
      } else {
        throw new Error("Failed to load configuration");
      }

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load configuration:", error);
      setError(error instanceof Error ? error.message : "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  // Handle Form Changes
  const handleInputChange = (field: keyof CTAConfig, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setSuccessMessage(null);
  };

  // Add Email Recipient
  const addEmailRecipient = () => {
    if (!newEmailRecipient.trim()) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmailRecipient.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    const currentRecipients = formData.emailRecipients || [];
    if (currentRecipients.includes(newEmailRecipient.trim())) {
      setError("Email address already exists");
      return;
    }

    handleInputChange("emailRecipients", [...currentRecipients, newEmailRecipient.trim()]);
    setNewEmailRecipient("");
    setError(null);
  };

  // Remove Email Recipient
  const removeEmailRecipient = (email: string) => {
    const currentRecipients = formData.emailRecipients || [];
    handleInputChange("emailRecipients", currentRecipients.filter(e => e !== email));
  };

  // Save Configuration
  const saveConfiguration = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch("/api/cta/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      const data = await response.json();
      
      if (data.success) {
        setConfig(data.config);
        setFormData(data.config);
        setHasChanges(false);
        setSuccessMessage("Configuration saved successfully!");
      } else {
        throw new Error(data.error || "Failed to save configuration");
      }

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to save configuration:", error);
      setError(error instanceof Error ? error.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  // Reset Form
  const resetForm = () => {
    if (config) {
      setFormData(config);
      setHasChanges(false);
      setError(null);
      setSuccessMessage(null);
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="light"
            startContent={<ArrowLeft className="w-4 h-4" />}
            onPress={() => router.push("/cta-management")}
          >
            Back
          </Button>
          <h1 className={title()}>CTA Configuration</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="light"
            startContent={<ArrowLeft className="w-4 h-4" />}
            onPress={() => router.push("/cta-management")}
          >
            Back
          </Button>
          <h1 className={title()}>CTA Configuration</h1>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="bordered"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={resetForm}
            isDisabled={!hasChanges}
          >
            Reset
          </Button>
          <Button
            color="primary"
            startContent={<Save className="w-4 h-4" />}
            onPress={saveConfiguration}
            isLoading={saving}
            isDisabled={!hasChanges}
          >
            Save Changes
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-danger-600" />
          <span className="text-danger-700">{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-success-50 border border-success-200 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-success-600" />
          <span className="text-success-700">{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* System Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold">System Settings</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable CTA System</p>
                  <p className="text-sm text-gray-600">
                    When enabled, QR codes will be displayed and forms can be submitted
                  </p>
                </div>
                <Switch
                  isSelected={formData.enabled || false}
                  onValueChange={(enabled) => handleInputChange("enabled", enabled)}
                  color="success"
                />
              </div>
              
              <Divider />
              
              <Input
                label="QR Code Base URL (Optional)"
                placeholder="Auto-detected from request"
                value={formData.qrCodeBaseUrl || ""}
                onValueChange={(value) => handleInputChange("qrCodeBaseUrl", value)}
                description="Base URL for QR codes. Leave empty to auto-detect from current domain (recommended)"
                startContent={<Globe className="w-4 h-4" />}
              />

              <Input
                type="number"
                label="Max Message Length"
                placeholder="500"
                value={formData.maxMessageLength?.toString() || "500"}
                onValueChange={(value) => handleInputChange("maxMessageLength", parseInt(value) || 500)}
                description="Maximum characters allowed in user messages"
                min={100}
                max={2000}
              />
            </CardBody>
          </Card>

          {/* Email Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-semibold">Email Settings</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <p className="font-medium mb-2">Email Recipients</p>
                <p className="text-sm text-gray-600 mb-3">
                  These email addresses will receive notifications when users submit the CTA form
                </p>
                
                <div className="space-y-2">
                  {(formData.emailRecipients || []).map((email, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm">{email}</span>
                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        isIconOnly
                        onPress={() => removeEmailRecipient(email)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="Enter email address"
                    value={newEmailRecipient}
                    onValueChange={setNewEmailRecipient}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        addEmailRecipient();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    variant="bordered"
                    startContent={<Plus className="w-4 h-4" />}
                    onPress={addEmailRecipient}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <Divider />

              <Input
                label="Email Subject"
                placeholder="New Avatar Chat Connection - {{userName}}"
                value={formData.emailSubject || ""}
                onValueChange={(value) => handleInputChange("emailSubject", value)}
                description="Use {{userName}} for dynamic user name insertion"
              />


            </CardBody>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Form Content */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-500" />
                <h2 className="text-lg font-semibold">Form Content</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                label="Form Title"
                placeholder="Connect with Weatherhead School of Management"
                value={formData.formTitle || ""}
                onValueChange={(value) => handleInputChange("formTitle", value)}
              />

              <Textarea
                label="Form Description"
                placeholder="Thank you for chatting with our AI avatar! Please share your details..."
                value={formData.formDescription || ""}
                onValueChange={(value) => handleInputChange("formDescription", value)}
                maxRows={4}
              />

              <Input
                label="Submit Button Text"
                placeholder="Submit & Connect"
                value={formData.submitButtonText || ""}
                onValueChange={(value) => handleInputChange("submitButtonText", value)}
              />

              <Textarea
                label="Success Message"
                placeholder="Thank you! We'll be in touch soon..."
                value={formData.successMessage || ""}
                onValueChange={(value) => handleInputChange("successMessage", value)}
                maxRows={3}
              />
            </CardBody>
          </Card>

          {/* Email Template */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-semibold">Email Template</h2>
              </div>
            </CardHeader>
            <CardBody>
              <Textarea
                label="Email Template"
                placeholder="Hello {{userName}}..."
                value={formData.emailTemplate || ""}
                onValueChange={(value) => handleInputChange("emailTemplate", value)}
                description="Available variables: {{userName}}, {{userEmail}}, {{userMessage}}, {{avatarName}}, {{submissionDate}}, {{sessionId}}"
                maxRows={12}
                className="font-mono text-sm"
              />
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Save Reminder */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 p-4 bg-warning-50 border border-warning-200 rounded-lg shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning-600" />
            <span className="text-warning-700">You have unsaved changes</span>
            <Button
              size="sm"
              color="primary"
              onPress={saveConfiguration}
              isLoading={saving}
            >
              Save Now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}