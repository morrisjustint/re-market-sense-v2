import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

type LogoProps = {
  className?: string
  href?: string
  showWordmark?: boolean
  variant?: "default" | "light"
  /** Official mark path. Drop your file at `public/logo.png` and pass `src="/logo.png"`. */
  src?: string
  /** Mark size in pixels (square). */
  size?: number
}

export function Logo({
  className,
  href = "/",
  showWordmark = true,
  variant = "default",
  src = "/logo.png",
  size = 36,
}: LogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src={src}
        alt="RE Market Sense"
        width={size}
        height={size}
        className="size-9 shrink-0 rounded-lg object-contain"
        priority
        unoptimized={src.endsWith(".svg")}
      />
      {showWordmark ? (
        <span
          className={cn(
            "font-heading text-lg font-semibold tracking-tight text-navy",
            variant === "light" && "text-white"
          )}
        >
          Market Sense
        </span>
      ) : null}
    </span>
  )

  if (href === undefined || href === "") {
    return content
  }

  return (
    <Link href={href} className="outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {content}
    </Link>
  )
}
