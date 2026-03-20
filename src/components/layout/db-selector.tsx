"use client";

import { Database, ChevronDown } from "lucide-react";
import { useSyncExternalStore, useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type TargetDatabase = "production" | "dev";

interface DatabaseOption {
  value: TargetDatabase;
  label: string;
  description: string;
}

const DATABASE_OPTIONS: DatabaseOption[] = [
  {
    value: "production",
    label: "生产环境",
    description: "真实数据",
  },
  {
    value: "dev",
    label: "开发环境",
    description: "测试数据",
  },
];

const STORAGE_KEY = "surety-database";
const DEFAULT_DB: TargetDatabase = "production";

let dbInitialized = false;

function initializeDb() {
  if (dbInitialized || typeof window === "undefined") return;
  dbInitialized = true;

  const stored = localStorage.getItem(STORAGE_KEY) as TargetDatabase | null;
  if (!stored || !DATABASE_OPTIONS.some((opt) => opt.value === stored)) {
    localStorage.setItem(STORAGE_KEY, DEFAULT_DB);
  }
}

function subscribeToDb(callback: () => void) {
  initializeDb();

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

function getSnapshot(): TargetDatabase {
  if (typeof window === "undefined") return DEFAULT_DB;
  initializeDb();
  return (localStorage.getItem(STORAGE_KEY) as TargetDatabase) || DEFAULT_DB;
}

function getServerSnapshot(): TargetDatabase {
  return DEFAULT_DB;
}

export function useDatabase() {
  return useSyncExternalStore(subscribeToDb, getSnapshot, getServerSnapshot);
}

export function DbSelector() {
  const currentDb = useDatabase();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingDb, setPendingDb] = useState<TargetDatabase | null>(null);

  const setDatabase = useCallback(
    async (db: TargetDatabase) => {
      if (db === currentDb) return;

      setPendingDb(db);
      localStorage.setItem(STORAGE_KEY, db);

      try {
        const response = await fetch("/api/database/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ database: db }),
        });

        if (!response.ok) {
          throw new Error("SWITCH_FAILED");
        }

        startTransition(() => {
          router.refresh();
        });
      } catch {
        localStorage.setItem(STORAGE_KEY, currentDb);
      } finally {
        setPendingDb(null);
      }
    },
    [currentDb, router],
  );

  const activeDb = pendingDb ?? currentDb;
  const currentOption = DATABASE_OPTIONS.find((opt) => opt.value === activeDb);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" disabled={isPending}>
          <Database className="h-4 w-4" />
          <span className="hidden sm:inline">{isPending ? "切换中..." : currentOption?.label}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {DATABASE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setDatabase(option.value)}
            className={activeDb === option.value ? "bg-accent" : ""}
            disabled={isPending}
          >
            <div className="flex flex-col">
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
