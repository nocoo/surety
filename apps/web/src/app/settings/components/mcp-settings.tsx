
import { useState, useEffect, useCallback } from "react";
import { Terminal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

export function McpSettings() {
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [mcpLoading, setMcpLoading] = useState(true);
  const [mcpPath, setMcpPath] = useState("~/workspace/personal/surety");

  // Load MCP setting from backend
  const loadMcpSetting = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/mcp.enabled");
      if (res.ok) {
        const data = await res.json();
        setMcpEnabled(data.value === "true");
      }
    } catch {
      // Setting doesn't exist yet, default to false
    } finally {
      setMcpLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMcpSetting();
  }, [loadMcpSetting]);

  // Toggle MCP setting via API with proper error handling
  const handleMcpToggle = async (enabled: boolean) => {
    const previousValue = mcpEnabled;
    setMcpEnabled(enabled); // Optimistic update

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "mcp.enabled", value: String(enabled) }),
      });

      if (!res.ok) {
        // Rollback optimistic state on failure
        setMcpEnabled(previousValue);
      }
    } catch {
      // Rollback on network error
      setMcpEnabled(previousValue);
    }
  };

  return (
    <div className="rounded-card bg-secondary p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
            <Terminal className="h-5 w-5 text-emerald-500" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="font-semibold">MCP 访问</h2>
            <p className="text-sm text-muted-foreground">
              允许外部 AI 助手（Claude Code、Cursor 等）查询保单数据
            </p>
          </div>
        </div>
        <Switch
          checked={mcpEnabled}
          onCheckedChange={handleMcpToggle}
          disabled={mcpLoading}
          aria-label="Toggle MCP access"
        />
      </div>
      {mcpEnabled && (
        <>
          <Separator className="my-4" />
          <div className="rounded-widget bg-muted/50 p-4">
            <p className="text-sm font-medium mb-2">配置方式</p>
            <p className="text-xs text-muted-foreground mb-3">
              在 AI 助手的 MCP 配置中添加以下内容：
            </p>
            <div className="mb-3">
              <Label htmlFor="mcp-path" className="text-xs text-muted-foreground mb-1 block">
                项目路径
              </Label>
              <Input
                id="mcp-path"
                value={mcpPath}
                onChange={(e) => setMcpPath(e.target.value)}
                className="text-xs font-mono h-8"
                placeholder="~/workspace/personal/surety"
              />
            </div>
            <pre className="text-xs bg-background rounded-widget p-3 overflow-x-auto">
{`{
  "mcpServers": {
    "surety": {
      "command": "bun",
      "args": ["run", "${mcpPath}/mcp/index.ts"],
      "cwd": "${mcpPath}"
    }
  }
}`}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
