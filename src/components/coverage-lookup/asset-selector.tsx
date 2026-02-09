"use client";

import { useRef, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Home, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatSumAssured, type AssetCoverageCard } from "@/lib/coverage-lookup-vm";

interface AssetSelectorProps {
  assets: AssetCoverageCard[];
  selectedAssetId: number | null;
  onSelectAsset: (assetId: number) => void;
}

export function AssetSelector({
  assets,
  selectedAssetId,
  onSelectAsset,
}: AssetSelectorProps) {
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
  }, [assets]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (assets.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        暂无资产
      </div>
    );
  }

  const getAssetIcon = (type: "RealEstate" | "Vehicle") => {
    return type === "Vehicle" ? Car : Home;
  };

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
        {assets.map((asset) => {
          const isSelected = asset.id === selectedAssetId;
          const Icon = getAssetIcon(asset.type);

          return (
            <button
              key={asset.id}
              onClick={() => onSelectAsset(asset.id)}
              className={cn(
                "flex-shrink-0 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all min-w-[140px]",
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div className={cn(
                "flex items-center justify-center h-12 w-12 rounded-full",
                isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">{asset.name}</p>
                <p className="text-xs text-muted-foreground">
                  {asset.typeLabel}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  {asset.activePolicyCount} 份保单
                </p>
                {asset.totalSumAssured > 0 && (
                  <p className="text-xs font-medium text-primary">
                    保额 {formatSumAssured(asset.totalSumAssured)}
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
