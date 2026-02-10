"use client";

import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarBrand,
  NavbarItem,
  NavbarMenuItem,
} from "@heroui/navbar";
import { Button } from "@heroui/button";
import { link as linkStyles } from "@heroui/theme";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import {
  Home,
  Settings,
  Users,
  Info,
  BotMessageSquare,
  ChartColumnBig,
  ChevronDown,
  User,
  Mail,
  Briefcase,
} from "lucide-react";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { WeatherheadLogo } from "@/components/kiosk";

// Icon mapping for navigation items
const iconMap = {
  Home,
  Settings,
  Users,
  ChartColumnBig,
  Mail,
  Info,
  Briefcase,
} as const;

export const AuthNavbar = () => {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();

  if (pathname.startsWith("/kiosk")) {
    return null;
  }

  if (loading) {
    return (
      <HeroUINavbar maxWidth="xl" position="sticky">
        <NavbarContent justify="center">
          <div>Loading...</div>
        </NavbarContent>
      </HeroUINavbar>
    );
  }

  return (
    <HeroUINavbar maxWidth="xl" position="sticky">
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink
            className="flex xl:flex-col justify-start items-center"
            href="/"
          >
            <p className="font-bold text-xl text-inherit mb-0 xl:mb-[-10] mr-10 xl:mr-0">
              AI Avatar Kiosk
            </p>
            <WeatherheadLogo variant="inline" />
          </NextLink>
        </NavbarBrand>
        {user && (
          <>
            {/* Desktop Navigation */}
            <ul className="hidden xl:flex gap-4 justify-start ml-2">
              {siteConfig.navItems.map((item) => {
                const IconComponent =
                  iconMap[item.icon as keyof typeof iconMap];
                const isActive = pathname === item.href;
                return (
                  <NavbarItem key={item.href} className="flex items-center">
                    <NextLink
                      className={clsx(
                        linkStyles({ color: "foreground" }),
                        "flex items-center gap-2",
                        isActive
                          ? "text-primary font-medium"
                          : "text-foreground hover:text-primary transition-colors"
                      )}
                      color="foreground"
                      href={item.href}
                    >
                      {IconComponent && <IconComponent size={20} />}
                      {item.label}
                    </NextLink>
                  </NavbarItem>
                );
              })}
              {/* DEV/ADMIN: Link to Chat Storage Test Page. Hidden in production! */}
              {process.env.NODE_ENV !== "production" && (
                <NavbarItem>
                  <NextLink
                    href="/test-pages"
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors text-sm font-semibold ml-2"
                    style={{ display: "inline-block" }}
                  >
                    Test Pages
                  </NextLink>
                </NavbarItem>
              )}
            </ul>

            {/* Mobile/Narrow Screen Dropdown */}
            <div className="xl:hidden relative group">
              {(() => {
                const currentItem = siteConfig.navItems.find(
                  (item) => item.href === pathname
                );
                const CurrentIcon = currentItem
                  ? iconMap[currentItem.icon as keyof typeof iconMap]
                  : Home;
                const currentLabel = currentItem ? currentItem.label : "Menu";

                return (
                  <div className="flex items-center gap-1 px-2 py-1 cursor-pointer text-foreground hover:text-primary transition-colors whitespace-nowrap">
                    {CurrentIcon && <CurrentIcon size={20} />}
                    <span>{currentLabel}</span>
                    <ChevronDown size={16} />
                  </div>
                );
              })()}

              {/* Dropdown Menu */}
              <div className="absolute top-full left-0 mt-1 bg-background border border-divider rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 min-w-48">
                <ul className="py-2">
                  {siteConfig.navItems.map((item) => {
                    const IconComponent =
                      iconMap[item.icon as keyof typeof iconMap];
                    const isActive = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <NextLink
                          className={clsx(
                            "flex items-center gap-3 px-4 py-2 hover:bg-default-100 transition-colors",
                            isActive
                              ? "text-primary font-medium bg-primary/10"
                              : "text-foreground"
                          )}
                          href={item.href}
                        >
                          {IconComponent && <IconComponent size={20} />}
                          {item.label}
                        </NextLink>
                      </li>
                    );
                  })}
                  {/* DEV/ADMIN: Link to Chat Storage Test Page. Hidden in production! */}
                  {process.env.NODE_ENV !== "production" && (
                    <li>
                      <NextLink
                        href="/test-pages"
                        className="flex items-center gap-3 px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors text-sm font-semibold mt-1"
                      >
                        Test Pages
                      </NextLink>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </>
        )}
      </NavbarContent>

      <NavbarContent className="basis-1/5 sm:basis-full" justify="end">
        {/* Desktop Right Side Items */}
        <NavbarItem className="hidden xl:flex gap-2">
          <ThemeSwitch />
        </NavbarItem>

        {user && (
          <NavbarItem className="hidden xl:flex gap-2">
            <div className="flex flex-col items-end whitespace-nowrap">
              <span className="text-sm text-default-600">
                Welcome, {user.name}
              </span>
              {user.authProvider === "cwru_sso" && (
                <span className="text-xs text-default-500">
                  CWRU SSO {user.studentId && `• ID: ${user.studentId}`}
                </span>
              )}
              {user.authProvider === "email" && (
                <span className="text-xs text-default-500">
                  Email Login • {user.role}
                </span>
              )}
            </div>
            <Button color="danger" variant="light" size="sm" onClick={logout}>
              Logout
            </Button>
          </NavbarItem>
        )}

        {/* Mobile/Narrow Screen User Dropdown */}
        {user && (
          <div className="xl:hidden relative group">
            <div className="flex items-center gap-1 px-2 py-1 cursor-pointer text-foreground hover:text-primary transition-colors whitespace-nowrap">
              <User size={20} />
              <span className="hidden sm:inline">
                {user.name.split(" ")[0]}
              </span>
              <ChevronDown size={16} />
            </div>

            {/* User Dropdown Menu */}
            <div className="absolute top-full right-0 mt-1 bg-background border border-divider rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 min-w-64">
              <div className="p-4 border-b border-divider">
                <div className="flex flex-col">
                  <span className="text-sm text-default-600 font-medium">
                    Welcome, {user.name}
                  </span>
                  {user.authProvider === "cwru_sso" && (
                    <span className="text-xs text-default-500 mt-1">
                      CWRU SSO {user.studentId && `• ID: ${user.studentId}`}
                    </span>
                  )}
                  {user.authProvider === "email" && (
                    <span className="text-xs text-default-500 mt-1">
                      Email Login • {user.role}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Theme</span>
                  <ThemeSwitch />
                </div>
                <Button
                  color="danger"
                  variant="flat"
                  size="sm"
                  onClick={logout}
                  className="w-full"
                >
                  Logout
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Theme switch for non-logged in users on narrow screens */}
        {!user && (
          <div className="lg:hidden">
            <ThemeSwitch />
          </div>
        )}
      </NavbarContent>

      <NavbarMenu>
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {user && (
            <NavbarMenuItem>
              <Button
                color="danger"
                variant="flat"
                onClick={logout}
                className="w-full"
              >
                Log Out
              </Button>
            </NavbarMenuItem>
          )}
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
