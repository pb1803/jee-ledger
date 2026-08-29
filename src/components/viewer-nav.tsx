"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./sign-out-button";

// Minimal, read-only navigation for the viewer. No create/edit actions.
export function ViewerNav() {
  const pathname = usePathname();
  const active = pathname.startsWith("/parent");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-zinc-800 dark:bg-zinc-950">
      <ul className="flex">
        <li className="flex-1">
          <Link
            href="/parent"
            aria-current={active ? "page" : undefined}
            className={`block min-h-[48px] py-3 text-center text-[11px] font-medium ${
              active ? "text-sky-600" : "text-zinc-500"
            }`}
          >
            Overview
          </Link>
        </li>
        <li className="flex-1">
          <SignOutButton className="block min-h-[48px] w-full py-3 text-center text-[11px] font-medium text-zinc-500" />
        </li>
      </ul>
    </nav>
  );
}
