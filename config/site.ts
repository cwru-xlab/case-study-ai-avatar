export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "CWRU WSOM AI Avatar",
  description: "CWRU WSOM AI Avatar",
  navItems: [
    {
      label: "Home",
      href: "/",
      icon: "Home",
    },
    {
      label: "System Settings",
      href: "/system-settings",
      icon: "Settings",
    },
    {
      label: "Case Management",
      href: "/case-management",
      icon: "Briefcase",
    },
    {
      label: "Avatar Profiles",
      href: "/avatar-profiles",
      icon: "Video",
    },
    {
      label: "Users and Usages",
      href: "/users-and-usages",
      icon: "ChartColumnBig",
    },
    {
      label: "CTA Management",
      href: "/cta-management",
      icon: "Mail",
    },
    {
      label: "Student History",
      href: "/student-history",
      icon: "History",
    },
  ],
  studentNavItems: [
    {
      label: "My Cases",
      href: "/student-cases",
      icon: "Briefcase",
    },
    {
      label: "Settings",
      href: "/student-cases/settings",
      icon: "Settings",
    },
  ],
  // JWT and Authentication Configuration
  auth: {
    // JWT token expiration time (for jose library)
    jwtExpiresIn: "45d", // 45 days
    // Cookie expiration time in seconds
    cookieMaxAge: 60 * 60 * 24 * 45, // 45 days in seconds
    // Cookie configuration
    cookie: {
      name: "auth-token",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    },
  },
  localCache: {
    avatarPreviewChatLocalStorageKeyPrefix: "wsom-ai-avatar-preview-chat-",
    addAvatarDraftLocalStorageKey: "wsom-ai-avatar-add-draft",
  },
};
