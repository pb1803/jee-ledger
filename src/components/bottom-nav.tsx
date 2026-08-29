"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home", enabled: true },
  { href: "/daily-log", label: "Log", enabled: true },
  { href: "/questions", label: "Questions", enabled: true },
  { href: "/revision", label: "Revise", enabled: true },
  { href: "/analytics", label: "Stats", enabled: true },
  { href: "/settings", label: "Settings", enabled: true },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-zinc-800 dark:bg-zinc-950">
      <ul className="flex">
        {ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const className = `block py-2.5 text-center text-[11px] font-medium ${
            active
              ? "text-sky-600"
              : "text-zinc-500 dark:text-zinc-400"
          }`;

          return (
            <li key={item.href} className="flex-1">
              {item.enabled ? (
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`${className} min-h-[48px] py-3`}
                >
                  {item.label}
                </Link>
              ) : (
                <span className={`${className} min-h-[48px] py-3 opacity-40`}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
