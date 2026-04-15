"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, MessageSquare, Home, Wrench, Database } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/contacts", icon: Users, label: "고객" },
  { href: "/messages", icon: MessageSquare, label: "문자" },
  { href: "/dashboard", icon: Home, label: "홈" },
  { href: "/tools", icon: Wrench, label: "도구함" },
  { href: "/db", icon: Database, label: "DB" },
];

interface BottomTabBarProps {
  className?: string;
}

export function BottomTabBar({ className }: BottomTabBarProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200",
        "safe-bottom",
        className
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex h-14">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  "flex flex-col items-center justify-center h-full gap-0.5 text-xs transition-colors",
                  isActive
                    ? "text-navy-900 border-t-2 border-gold-500"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                <tab.icon
                  className={cn("w-5 h-5", isActive ? "fill-current" : "")}
                />
                <span className="font-medium">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
