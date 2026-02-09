"use client";

import { useRef, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getMemberAvatarColors, getNameInitial } from "@/lib/category-config";
import { formatSumAssured, type MemberCoverageCard } from "@/lib/coverage-lookup-vm";

interface MemberSelectorProps {
  members: MemberCoverageCard[];
  selectedMemberId: number | null;
  onSelectMember: (memberId: number) => void;
}

export function MemberSelector({
  members,
  selectedMemberId,
  onSelectMember,
}: MemberSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [members]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (members.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        暂无家庭成员
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Left scroll button */}
      {canScrollLeft && (
        <Button
          variant="outline"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background shadow-md"
          onClick={() => scroll("left")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide py-1 px-1"
        onScroll={checkScroll}
      >
        {members.map((member) => {
          const isSelected = member.id === selectedMemberId;
          const colors = getMemberAvatarColors(member.name);

          return (
            <button
              key={member.id}
              onClick={() => onSelectMember(member.id)}
              className={cn(
                "flex-shrink-0 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all min-w-[120px]",
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <Avatar size="lg">
                <AvatarFallback className={cn(colors.bg, colors.text)}>
                  {getNameInitial(member.name)}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="text-sm font-medium">{member.name}</p>
                <p className="text-xs text-muted-foreground">
                  {member.relationLabel}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  {member.activePolicyCount} 份保单
                </p>
                {member.totalSumAssured > 0 && (
                  <p className="text-xs font-medium text-primary">
                    保额 {formatSumAssured(member.totalSumAssured)}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Right scroll button */}
      {canScrollRight && (
        <Button
          variant="outline"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background shadow-md"
          onClick={() => scroll("right")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
