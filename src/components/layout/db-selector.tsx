"use client";

import { Database, ChevronDown } from "lucide-react";
import { useSyncExternalStore, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type DatabaseType = "production" | "example" | "test";

interface DatabaseOption {
  value: DatabaseType;
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
    value: "example",
    label: "示例数据",
    description: "演示用数据",
  },
  {
    value: "test",
    label: "测试数据",
    description: "E2E 测试",
  },
];

const STORAGE_KEY = "surety-database";
const DEFAULT_DB: DatabaseType = "production";

let dbInitialized = false;

function initializeDb() {
  if (dbInitialized || typeof window === "undefined") return;
  dbInitialized = true;
  
  const stored = localStorage.getItem(STORAGE_KEY) as DatabaseType | null;
  if (!stored || !DATABASE_OPTIONS.some((opt) => opt.value === stored)) {
    localStorage.setItem(STORAGE_KEY, DEFAULT_DB);
  }
}

function subscribeToDb(callback: () => void) {
  initializeDb();
  
  // Listen for storage changes from other tabs
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

function getSnapshot(): DatabaseType {
  if (typeof window === "undefined") return DEFAULT_DB;
  initializeDb();
  return (localStorage.getItem(STORAGE_KEY) as DatabaseType) || DEFAULT_DB;
}

function getServerSnapshot(): DatabaseType {
  return DEFAULT_DB;
}

export function useDatabase() {
  return useSyncExternalStore(subscribeToDb, getSnapshot, getServerSnapshot);
}

export function DbSelector() {
  const currentDb = useDatabase();

  const setDatabase = useCallback(async (db: DatabaseType) => {
    localStorage.setItem(STORAGE_KEY, db);
    
    // Notify the server about the database change
    try {
      await fetch("/api/database/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ database: db }),
      });
    } catch {
      // Silently fail, will retry on next request
    }
    
    // Reload the page to apply the new database
    window.location.reload();
  }, []);

  const currentOption = DATABASE_OPTIONS.find((opt) => opt.value === currentDb);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Database className="h-4 w-4" />
          <span className="hidden sm:inline">{currentOption?.label}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {DATABASE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setDatabase(option.value)}
            className={currentDb === option.value ? "bg-accent" : ""}
          >
            <div className="flex flex-col">
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
