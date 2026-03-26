"use client";

import { useState, ReactNode } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditableSectionProps {
  title: string;
  children: ReactNode;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
  saveError?: string | null;
}

export function EditableSection({
  title,
  children,
  onSave,
  isSaving,
  saveError,
}: EditableSectionProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    await onSave();
    setIsEditing(false);
  };

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          {title}
        </h3>
        {!isEditing ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-success hover:text-success"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-destructive hover:text-destructive"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {typeof children === "function"
          ? (children as (isEditing: boolean) => ReactNode)(isEditing)
          : children}
      </div>
      {saveError && isEditing && (
        <p className="text-xs text-destructive mt-2">{saveError}</p>
      )}
    </div>
  );
}
