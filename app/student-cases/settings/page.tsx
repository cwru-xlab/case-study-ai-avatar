"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Switch } from "@heroui/switch";
import { Divider } from "@heroui/divider";
import { User, Mail, Bell, LogOut } from "lucide-react";

import { title } from "@/components/primitives";

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  studentId: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  caseReminders: boolean;
  dueDateAlerts: boolean;
}

export default function StudentSettingsPage() {
  const [profile, setProfile] = useState<UserProfile>({
    firstName: "John",
    lastName: "Doe",
    email: "jdoe@case.edu",
    studentId: "jxd123",
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailNotifications: true,
    caseReminders: true,
    dueDateAlerts: false,
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
    }, 500);
  };

  const handleLogout = () => {
    // Mock logout - would redirect to login page
    console.log("Logging out...");
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className={title()}>Settings</h1>
        <p className="text-default-500">
          Manage your profile and preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader className="flex gap-3">
              <User className="text-primary" size={20} />
              <p className="font-semibold">Profile Information</p>
            </CardHeader>
            <CardBody className="gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  value={profile.firstName}
                  onChange={(e) =>
                    setProfile({ ...profile, firstName: e.target.value })
                  }
                />
                <Input
                  label="Last Name"
                  value={profile.lastName}
                  onChange={(e) =>
                    setProfile({ ...profile, lastName: e.target.value })
                  }
                />
              </div>
              <Input
                label="Email"
                startContent={<Mail className="text-default-400" size={16} />}
                type="email"
                value={profile.email}
                onChange={(e) =>
                  setProfile({ ...profile, email: e.target.value })
                }
              />
              <Input
                isReadOnly
                description="Student ID cannot be changed"
                label="Student ID"
                value={profile.studentId}
              />
              <div className="flex justify-end">
                <Button
                  color="primary"
                  isLoading={isSaving}
                  onPress={handleSave}
                >
                  Save Changes
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex gap-3">
              <Bell className="text-primary" size={20} />
              <p className="font-semibold">Notifications</p>
            </CardHeader>
            <CardBody className="gap-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">Email Notifications</p>
                  <p className="text-xs text-default-400">
                    Receive updates via email
                  </p>
                </div>
                <Switch
                  isSelected={notifications.emailNotifications}
                  onValueChange={(value) =>
                    setNotifications({ ...notifications, emailNotifications: value })
                  }
                />
              </div>
              <Divider />
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">Case Reminders</p>
                  <p className="text-xs text-default-400">
                    Get reminded about assigned cases
                  </p>
                </div>
                <Switch
                  isSelected={notifications.caseReminders}
                  onValueChange={(value) =>
                    setNotifications({ ...notifications, caseReminders: value })
                  }
                />
              </div>
              <Divider />
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">Due Date Alerts</p>
                  <p className="text-xs text-default-400">
                    Notify before case deadlines
                  </p>
                </div>
                <Switch
                  isSelected={notifications.dueDateAlerts}
                  onValueChange={(value) =>
                    setNotifications({ ...notifications, dueDateAlerts: value })
                  }
                />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardBody className="items-center text-center py-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-primary">
                  {profile.firstName[0]}
                  {profile.lastName[0]}
                </span>
              </div>
              <p className="font-semibold">
                {profile.firstName} {profile.lastName}
              </p>
              <p className="text-sm text-default-500">{profile.email}</p>
              <p className="text-xs text-default-400 font-mono mt-1">
                {profile.studentId}
              </p>
            </CardBody>
          </Card>

          <Card className="border-danger/20">
            <CardBody>
              <Button
                fullWidth
                color="danger"
                startContent={<LogOut size={18} />}
                variant="flat"
                onPress={handleLogout}
              >
                Log Out
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
