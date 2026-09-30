"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeHref } from "@/lib/nav/section";

// The top nav's inline links with a "you are here" mark: the current
// section gets aria-current="page" and an underline. A sub-page lights its
// parent (/calendar → Rentals, /invest/pro → Invest).
export default function NavLinks({
  links,
  className,
}: {
  links: { href: string; label: string }[];
  className: string;
}) {
  const pathname = usePathname();
  const current = activeHref(pathname, links.map((link) => link.href));
  return (
    <div className={className}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.href === current ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
