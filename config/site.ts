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
      label: "Avatar Management",
      href: "/avatar-management",
      icon: "Users",
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
    // {
    //   label: "About",
    //   href: "/about",
    //   icon: "Info",
    // },
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
