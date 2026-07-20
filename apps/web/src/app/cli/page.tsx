import { Cloud, Key, Loader2, Terminal, Trash2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { fetchAPI } from "@/api";
import { AppShell } from "@/components/layout";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface ApiToken {
	id: number;
	name: string | null;
	tokenPrefix: string;
	createdAt: string;
	lastUsedAt: string | null;
	expiresAt: string | null;
}

function formatDate(value: string | null): string {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export default function CliPage() {
	const {
		data: tokens,
		error,
		isLoading,
		mutate,
	} = useSWR<ApiToken[]>("/api/auth/tokens", fetchAPI);

	const [pendingRevoke, setPendingRevoke] = useState<ApiToken | null>(null);
	const [revoking, setRevoking] = useState(false);
	const [revokeError, setRevokeError] = useState<string | null>(null);

	const handleRevoke = async () => {
		if (!pendingRevoke) return;
		setRevoking(true);
		setRevokeError(null);
		try {
			const res = await fetch(`/api/auth/tokens/${pendingRevoke.id}`, {
				method: "DELETE",
				credentials: "include",
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(body.error ?? `HTTP ${res.status}`);
			}
			await mutate();
			setPendingRevoke(null);
		} catch (e) {
			setRevokeError(e instanceof Error ? e.message : "撤销失败");
		} finally {
			setRevoking(false);
		}
	};

	return (
		<AppShell breadcrumbs={[{ label: "CLI" }]}>
			<div className="space-y-6">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">CLI</h1>
					<p className="text-sm text-muted-foreground">
						<code className="rounded bg-secondary px-1 py-0.5 text-xs">@nocoo/surety</code> 是 AI
						助手与脚本访问 Surety 的命令行入口
					</p>
				</div>

				{/* Card 1: Install & Usage */}
				<div className="rounded-card bg-secondary p-6">
					<div className="flex items-center gap-3 mb-4">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
							<Terminal className="h-5 w-5 text-primary" strokeWidth={1.5} />
						</div>
						<div>
							<h2 className="font-semibold">安装与使用</h2>
							<p className="text-sm text-muted-foreground">只需 Bun 运行时，无需额外配置</p>
						</div>
					</div>
					<Separator className="mb-4" />
					<div className="space-y-4 text-sm">
						<div>
							<p className="mb-2 font-medium">1. 安装</p>
							<pre className="overflow-x-auto rounded-md bg-background p-3 text-xs">
								<code>bun add -g @nocoo/surety</code>
							</pre>
							<p className="mt-1 text-xs text-muted-foreground">
								或临时使用：<code className="rounded bg-background px-1">bunx @nocoo/surety</code>
							</p>
						</div>
						<div>
							<p className="mb-2 font-medium">2. 登录（浏览器铸 token）</p>
							<pre className="overflow-x-auto rounded-md bg-background p-3 text-xs">
								<code>surety login</code>
							</pre>
						</div>
						<div>
							<p className="mb-2 font-medium">3. 验证身份</p>
							<pre className="overflow-x-auto rounded-md bg-background p-3 text-xs">
								<code>surety whoami</code>
							</pre>
						</div>
						<div>
							<p className="mb-2 font-medium">4. 业务命令</p>
							<pre className="overflow-x-auto rounded-md bg-background p-3 text-xs">
								<code>{`surety members list
surety policies list
surety --help`}</code>
							</pre>
						</div>
						<div className="flex flex-wrap gap-3 pt-2 text-xs">
							<a
								href="https://www.npmjs.com/package/@nocoo/surety"
								target="_blank"
								rel="noreferrer"
								className="text-primary hover:underline"
							>
								npm 包页面 →
							</a>
							<a
								href="https://github.com/nocoo/surety/blob/main/apps/cli/README.md"
								target="_blank"
								rel="noreferrer"
								className="text-primary hover:underline"
							>
								完整命令清单 →
							</a>
						</div>
					</div>
				</div>

				{/* Card 2: Auth */}
				<div className="rounded-card bg-secondary p-6">
					<div className="flex items-center gap-3 mb-4">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
							<Cloud className="h-5 w-5 text-info" strokeWidth={1.5} />
						</div>
						<div>
							<h2 className="font-semibold">认证机制</h2>
							<p className="text-sm text-muted-foreground">双域名分离：登录入口与数据面</p>
						</div>
					</div>
					<Separator className="mb-4" />
					<div className="space-y-4 text-sm">
						<div>
							<p className="font-medium">域名职责</p>
							<ul className="mt-2 space-y-2 text-muted-foreground">
								<li>
									<code className="rounded bg-background px-1 text-foreground">
										surety.hexly.ai
									</code>
									：Cloudflare Access (Google OAuth) 保护的铸 token 入口；
									<code className="rounded bg-background px-1 text-foreground">surety login</code>{" "}
									走这里
								</li>
								<li>
									<code className="rounded bg-background px-1 text-foreground">
										surety-api.hexly.ai
									</code>
									：纯 Bearer token 数据面，所有 CLI 业务命令打这里
								</li>
							</ul>
						</div>
						<div>
							<p className="font-medium">环境变量（可选覆盖）</p>
							<pre className="mt-2 overflow-x-auto rounded-md bg-background p-3 text-xs">
								<code>{`SURETY_LOGIN_URL=https://surety.hexly.ai
SURETY_API_URL=https://surety-api.hexly.ai
SURETY_API_TOKEN=sk_xxx   # 跳过 surety login 直接注入`}</code>
							</pre>
						</div>
						<div>
							<p className="font-medium">配置文件位置</p>
							<p className="mt-1 text-muted-foreground">
								<code className="rounded bg-background px-1 text-foreground">
									~/.config/surety/config.json
								</code>{" "}
								保存默认 API URL 与已铸的 token
							</p>
						</div>
					</div>
				</div>

				{/* Card 3: Token Management */}
				<div className="rounded-card bg-secondary p-6">
					<div className="flex items-center gap-3 mb-4">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
							<Key className="h-5 w-5 text-warning-text" strokeWidth={1.5} />
						</div>
						<div>
							<h2 className="font-semibold">Token 管理</h2>
							<p className="text-sm text-muted-foreground">查看和撤销当前账号下的所有 API token</p>
						</div>
					</div>
					<Separator className="mb-4" />

					{isLoading && (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" />
							加载中…
						</div>
					)}

					{error && !isLoading && (
						<p className="text-sm text-destructive" role="alert">
							加载失败：{error instanceof Error ? error.message : String(error)}
						</p>
					)}

					{!isLoading && !error && tokens && tokens.length === 0 && (
						<div className="rounded-widget border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">
							暂无 token，请在终端运行{" "}
							<code className="rounded bg-secondary px-1 text-foreground">surety login</code>{" "}
							铸造首个 token
						</div>
					)}

					{!isLoading && !error && tokens && tokens.length > 0 && (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>名称</TableHead>
										<TableHead>前缀</TableHead>
										<TableHead>创建时间</TableHead>
										<TableHead>最后使用</TableHead>
										<TableHead>过期时间</TableHead>
										<TableHead className="text-right">操作</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{tokens.map((t) => (
										<TableRow key={t.id}>
											<TableCell>{t.name ?? "—"}</TableCell>
											<TableCell>
												<code className="rounded bg-background px-1 text-xs">{t.tokenPrefix}…</code>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{formatDate(t.createdAt)}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{formatDate(t.lastUsedAt)}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{formatDate(t.expiresAt)}
											</TableCell>
											<TableCell className="text-right">
												<Button variant="ghost" size="sm" onClick={() => setPendingRevoke(t)}>
													<Trash2 className="h-4 w-4" />
													<span className="sr-only">撤销 token</span>
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}

					<p className="mt-4 text-xs text-muted-foreground">
						新 token 通过{" "}
						<code className="rounded bg-background px-1 text-foreground">surety login</code>{" "}
						浏览器流自动铸造，本页面不提供创建按钮
					</p>
				</div>
			</div>

			<AlertDialog
				open={pendingRevoke !== null}
				onOpenChange={(open) => {
					if (!open) {
						setPendingRevoke(null);
						setRevokeError(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>确认撤销 token？</AlertDialogTitle>
						<AlertDialogDescription>
							撤销后使用此 token 的 CLI 或脚本将立即无法访问 API，且不可恢复。
							{pendingRevoke && (
								<span className="mt-2 block">
									目标：
									<code className="ml-1 rounded bg-secondary px-1 text-foreground">
										{pendingRevoke.name ?? `${pendingRevoke.tokenPrefix}…`}
									</code>
								</span>
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					{revokeError && (
						<p className="text-sm text-destructive" role="alert">
							{revokeError}
						</p>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={revoking}>取消</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={(e) => {
								e.preventDefault();
								void handleRevoke();
							}}
							disabled={revoking}
						>
							{revoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							撤销
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</AppShell>
	);
}
