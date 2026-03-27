export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "AI Case Study",
  description: "AI Case Study",
  navItems: [
    {
      label: "Home",
      href: "/",
      icon: "Home",
    },
    {
      label: "Case Management",
      href: "/case-management",
      icon: "Briefcase",
    },

    {
      label: "Avatar Management",
      href: "/avatar-profiles",
      icon: "Video",
    },
    {
      label: "Cohort Management",
      href: "/codes",
      icon: "GraduationCap",
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
