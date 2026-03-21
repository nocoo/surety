import { Loader2 } from "lucide-react";

interface PageLoadingProps {
  text?: string;
}

export function PageLoading({ text = "加载中..." }: PageLoadingProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">{text}</span>
      </div>
    </div>
  );
}
