"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import {
  Home,
  Settings,
  Users,
  ChartColumnBig,
  ChevronLeft,
  ChevronRight,
  User,
  Mail,
  Video,
  Briefcase,
  History,
  GraduationCap,
  QrCode,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { WeatherheadLogo } from "@/components/kiosk";

const iconMap = {
  Home,
  Settings,
  Users,
  ChartColumnBig,
  Mail,
  Video,
  Briefcase,
  History,
  GraduationCap,
  QrCode,
} as const;

export const AuthNavbar = () => {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname.startsWith("/kiosk")) {
    return null;
  }

  if (loading) {
    return (
      <aside className="hidden md:flex flex-col items-center justify-center w-64 min-h-screen bg-background border-r border-divider">
        <div className="text-sm text-default-500">Loading...</div>
      </aside>
    );
  }

  const navItems =
    user?.role === "student"
      ? siteConfig.studentNavItems
      : siteConfig.navItems;

  const sidebarWidth = collapsed ? "w-[68px]" : "w-64";

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className={clsx("p-4 border-b border-divider", collapsed && "px-2")}>
        <NextLink
          className={clsx(
            "flex items-center gap-3",
            collapsed && "justify-center"
          )}
          href="/"
          onClick={() => setMobileOpen(false)}
        >
          {collapsed ? (
            <WeatherheadLogo variant="inline" />
          ) : (
            <>
              <div className="flex flex-col">
                <p className="font-bold text-lg text-inherit leading-tight">
                  AI Case Study
                </p>
              </div>
            </>
          )}
        </NextLink>
        {!collapsed && (
          <div className="mt-2">
            <WeatherheadLogo variant="inline" />
          </div>
        )}
      </div>

      {/* Nav Items */}
      {user && (
        <nav className="flex-1 overflow-y-auto py-2">
          <ul className="flex flex-col gap-0.5 px-2">
            {navItems.map((item) => {
              const IconComponent =
                iconMap[item.icon as keyof typeof iconMap];
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <NextLink
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm",
                      collapsed && "justify-center px-2",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-default-100 hover:text-primary"
                    )}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    {IconComponent && (
                      <IconComponent size={20} className="shrink-0" />
                    )}
                    {!collapsed && <span>{item.label}</span>}
                  </NextLink>
                </li>
              );
            })}
            {process.env.NODE_ENV !== "production" && (
              <li>
                <NextLink
                  href="/test-pages"
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors font-semibold mt-1",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? "Test Pages" : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  {!collapsed && <span>Test Pages</span>}
                  {collapsed && <span className="text-xs">TP</span>}
                </NextLink>
              </li>
            )}
          </ul>
        </nav>
      )}

      {/* Bottom Section: Theme, User Info, Logout */}
      <div className="mt-auto border-t border-divider p-3">
        <div
          className={clsx(
            "flex items-center mb-3",
            collapsed ? "justify-center" : "justify-between px-1"
          )}
        >
          {!collapsed && (
            <span className="text-xs text-default-500">Theme</span>
          )}
          <ThemeSwitch />
        </div>

        {user && (
          <>
            {!collapsed && (
              <div className="px-1 mb-3">
                <p className="text-sm text-default-600 font-medium truncate">
                  {user.name}
                </p>
                {user.authProvider === "cwru_sso" && (
                  <p className="text-xs text-default-500 truncate">
                    CWRU SSO{user.studentId && ` • ID: ${user.studentId}`}
                  </p>
                )}
                {user.authProvider === "email" && (
                  <p className="text-xs text-default-500 truncate">
                    Email Login • {user.role}
                  </p>
                )}
              </div>
            )}
            {collapsed && (
              <div className="flex justify-center mb-3" title={user.name}>
                <User size={20} className="text-default-500" />
              </div>
            )}
            <button
              onClick={logout}
              className={clsx(
                "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/10 transition-colors",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? "Logout" : undefined}
            >
              <LogOut size={18} className="shrink-0" />
              {!collapsed && <span>Logout</span>}
            </button>
          </>
        )}
      </div>

      {/* Collapse Toggle (desktop only) */}
      <div className="hidden md:flex border-t border-divider p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full p-2 rounded-lg text-default-500 hover:bg-default-100 hover:text-foreground transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight size={18} />
          ) : (
            <ChevronLeft size={18} />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="md:hidden fixed top-4 left-4 z-60 p-2 rounded-lg bg-background border border-divider shadow-md"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={clsx(
          "md:hidden fixed top-0 left-0 z-50 h-full w-64 bg-background border-r border-divider transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={clsx(
          "hidden md:flex flex-col min-h-screen bg-background border-r border-divider transition-all duration-200 shrink-0",
          sidebarWidth
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
