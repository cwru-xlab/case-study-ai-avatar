"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Briefcase, GraduationCap, Video, ArrowRight } from "lucide-react";
import { title } from "@/components/primitives";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role === "student") {
      router.replace("/student-cases");
    }
  }, [user, loading, router]);

  const navigationCards = [
    {
      title: "Cases",
      description: "Create and manage case studies with multiple avatar roles and evaluation criteria",
      icon: Briefcase,
      href: "/case-management",
      color: "primary" as const,
    },
    {
      title: "Cohorts",
      description: "Manage student cohorts, send invitations, and track enrollment",
      icon: GraduationCap,
      href: "/codes",
      color: "secondary" as const,
    },
    {
      title: "Avatars",
      description: "Configure AI avatar profiles with video, voice, and personality settings",
      icon: Video,
      href: "/avatar-profiles",
      color: "success" as const,
    },
  ];

  if (loading) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div>Loading...</div>
      </section>
    );
  }

  return (
    <section className="flex flex-col items-center gap-8 py-8 md:py-10 max-w-5xl mx-auto px-4">
      <div className="text-center">
        <h1 className={title()}>AI Case Study</h1>
        <p className="text-default-500 mt-4 text-lg">
          Welcome back, {user?.name || "User"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {navigationCards.map((card) => {
          const IconComponent = card.icon;
          return (
            <Card
              key={card.title}
              isPressable
              className="hover:scale-[1.02] transition-transform"
              onPress={() => router.push(card.href)}
            >
              <CardBody className="p-6 flex flex-col gap-4">
                <div className={`w-12 h-12 rounded-lg bg-${card.color}/10 flex items-center justify-center`}>
                  <IconComponent className={`w-6 h-6 text-${card.color}`} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{card.title}</h2>
                  <p className="text-default-500 text-sm mt-1">
                    {card.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-primary text-sm font-medium mt-auto">
                  <span>Manage</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

    </section>
  );
}
