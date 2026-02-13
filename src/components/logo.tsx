"use client";

import Image from "next/image";
import { useAppliedTheme } from "@/hooks/use-applied-theme";
import { cn } from "@/lib/utils";

const SIZE_MAP = {
  sm: { px: 24, file: "24" },
  lg: { px: 80, file: "80" },
} as const;

type LogoSize = keyof typeof SIZE_MAP;

interface LogoProps {
  size?: LogoSize;
  className?: string;
}

export function Logo({ size = "sm", className }: LogoProps) {
  const theme = useAppliedTheme();
  const { px, file } = SIZE_MAP[size];

  return (
    <Image
      src={`/logo-${theme}-${file}.png`}
      alt="Surety"
      width={px}
      height={px}
      className={cn("shrink-0", className)}
      priority
    />
  );
}
