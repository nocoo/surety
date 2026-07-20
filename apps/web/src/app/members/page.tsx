import { AlertCircle, Pencil, Plus, Shield, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout";
import { TablePageSkeleton } from "@/components/skeletons";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useOpenSheetOnNewParam } from "@/hooks/use-open-sheet-on-new-param";
import { cn, getAvatarColor } from "@/lib/utils";
import { MemberSheet } from "./member-sheet";

type Relation = "Self" | "Spouse" | "Child" | "Parent";

interface Member {
	id: number;
	name: string;
	relation: Relation;
	gender: "M" | "F" | null;
	birthDate: string | null;
	idCard: string | null;
	idType: string | null;
	idExpiry: string | null;
	phone: string | null;
	hasSocialInsurance: boolean | null;
	policyCount?: number;
}

const relationLabels: Record<Relation, string> = {
	Self: "本人",
	Spouse: "配偶",
	Child: "子女",
	Parent: "父母",
};

const relationVariants: Record<Relation, "default" | "info" | "success" | "purple"> = {
	Self: "default",
	Spouse: "info",
	Child: "success",
	Parent: "purple",
};

function calculateAge(birthDate: string | null): { years: number; months: number } | null {
	if (!birthDate) return null;
	const today = new Date();
	const parts = birthDate.split("-").map(Number);
	const birthYear = parts[0] ?? 0;
	const birthMonth = (parts[1] ?? 1) - 1;
	const birthDay = parts[2] ?? 1;
	let years = today.getFullYear() - birthYear;
	let months = today.getMonth() - birthMonth;
	if (today.getDate() < birthDay) {
		months--;
	}
	if (months < 0) {
		years--;
		months += 12;
	}
	return { years, months };
}

export default function MembersPage() {
	const [members, setMembers] = useState<Member[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [editingMember, setEditingMember] = useState<Member | null>(null);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);

	const fetchMembers = () => {
		fetch("/api/members")
			.then((res) => {
				if (!res.ok) throw new Error("FETCH_FAILED");
				return res.json();
			})
			.then((data: Member[]) => {
				setMembers(data);
				setError(null);
				setLoading(false);
			})
			.catch(() => {
				setError("加载家庭成员失败，请刷新页面重试");
				setLoading(false);
			});
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: mount-only initial fetch
	useEffect(() => {
		fetchMembers();
	}, []);

	useOpenSheetOnNewParam(() => {
		setEditingMember(null);
		setSheetOpen(true);
	});

	const handleAdd = () => {
		setEditingMember(null);
		setSheetOpen(true);
	};

	const handleEdit = (member: Member) => {
		setEditingMember(member);
		setSheetOpen(true);
	};

	const handleDeleteClick = (member: Member) => {
		setMemberToDelete(member);
		setDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = async () => {
		if (!memberToDelete) return;

		setDeleteError(null);
		try {
			const response = await fetch(`/api/members/${memberToDelete.id}`, {
				method: "DELETE",
			});

			if (response.ok) {
				setDeleteDialogOpen(false);
				setMemberToDelete(null);
				fetchMembers();
			} else {
				const data = await response.json().catch(() => null);
				setDeleteError(data?.error ?? "删除成员失败，请重试");
			}
		} catch {
			setDeleteError("网络异常，请检查连接后重试");
		}
	};

	if (loading) {
		return (
			<AppShell breadcrumbs={[{ label: "家庭成员" }]}>
				<TablePageSkeleton rows={6} columns={9} withFilters={false} />
			</AppShell>
		);
	}

	if (error) {
		return (
			<AppShell breadcrumbs={[{ label: "家庭成员" }]}>
				<div className="rounded-card bg-secondary p-8 text-center">
					<AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
					<h3 className="mt-4 text-lg font-medium">加载失败</h3>
					<p className="mt-2 text-sm text-muted-foreground">{error}</p>
				</div>
			</AppShell>
		);
	}

	return (
		<AppShell breadcrumbs={[{ label: "家庭成员" }]}>
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">家庭成员</h1>
						<p className="text-sm text-muted-foreground">共 {members.length} 位成员</p>
					</div>
					<Button onClick={handleAdd}>
						<Plus className="mr-2 h-4 w-4" />
						添加成员
					</Button>
				</div>

				{members.length === 0 ? (
					<EmptyState
						icon={Users}
						title="还没有家庭成员"
						description="先把家人添加进来 —— 本人、配偶、子女、父母都可以。之后所有保单都会自动关联到他们"
						action={
							<Button onClick={handleAdd}>
								<Plus className="h-4 w-4 mr-1.5" />
								添加第一位家庭成员
							</Button>
						}
					/>
				) : (
					<div className="rounded-card bg-secondary">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>姓名</TableHead>
									<TableHead>关系</TableHead>
									<TableHead>性别</TableHead>
									<TableHead>年龄</TableHead>
									<TableHead>出生日期</TableHead>
									<TableHead>手机号</TableHead>
									<TableHead className="text-center">社保</TableHead>
									<TableHead className="text-center">保单数</TableHead>
									<TableHead className="w-[100px]">操作</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{members.map((member) => {
									const age = calculateAge(member.birthDate);
									return (
										<TableRow key={member.id}>
											<TableCell>
												<div className="flex items-center gap-3">
													<Avatar className="h-8 w-8">
														<AvatarFallback
															className={cn("text-sm text-white", getAvatarColor(member.name))}
														>
															{member.name[0]}
														</AvatarFallback>
													</Avatar>
													<span className="font-medium">{member.name}</span>
												</div>
											</TableCell>
											<TableCell>
												<Badge variant={relationVariants[member.relation]}>
													{relationLabels[member.relation]}
												</Badge>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{member.gender === "M" ? "男" : member.gender === "F" ? "女" : "-"}
											</TableCell>
											<TableCell>
												{age !== null ? (
													<>
														<span className="font-medium">{age.years}</span>
														<span className="text-muted-foreground"> 岁</span>
														{age.years < 5 && age.months > 0 && (
															<>
																<span className="font-medium">{age.months}</span>
																<span className="text-muted-foreground"> 个月</span>
															</>
														)}
													</>
												) : (
													<span className="text-muted-foreground">-</span>
												)}
											</TableCell>
											<TableCell className="font-mono text-sm text-muted-foreground">
												{member.birthDate ?? "-"}
											</TableCell>
											<TableCell className="text-muted-foreground">{member.phone ?? "-"}</TableCell>
											<TableCell className="text-center">
												{member.hasSocialInsurance === true ? (
													<Badge variant="success" className="text-xs">
														有
													</Badge>
												) : member.hasSocialInsurance === false ? (
													<span className="text-muted-foreground text-xs">无</span>
												) : (
													<span className="text-muted-foreground">-</span>
												)}
											</TableCell>
											<TableCell className="text-center">
												{member.policyCount && member.policyCount > 0 ? (
													<div className="flex items-center justify-center gap-1">
														<Shield className="h-3 w-3 text-success" />
														<span className="text-sm">{member.policyCount}</span>
													</div>
												) : (
													<span className="text-muted-foreground">-</span>
												)}
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-1">
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8"
														onClick={() => handleEdit(member)}
													>
														<Pencil className="h-4 w-4" />
														<span className="sr-only">编辑</span>
													</Button>
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<span>
																	<Button
																		variant="ghost"
																		size="icon"
																		className="h-8 w-8 text-destructive hover:text-destructive"
																		disabled={member.relation === "Self"}
																		onClick={() => handleDeleteClick(member)}
																		aria-label={
																			member.relation === "Self" ? "本人记录不能删除" : "删除成员"
																		}
																	>
																		<Trash2 className="h-4 w-4" />
																		<span className="sr-only">删除</span>
																	</Button>
																</span>
															</TooltipTrigger>
															{member.relation === "Self" && (
																<TooltipContent>本人记录不能删除</TooltipContent>
															)}
														</Tooltip>
													</TooltipProvider>
												</div>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}
			</div>

			<MemberSheet
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				member={editingMember}
				onSuccess={fetchMembers}
			/>

			<AlertDialog
				open={deleteDialogOpen}
				onOpenChange={(open) => {
					setDeleteDialogOpen(open);
					if (!open) setDeleteError(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>确认删除</AlertDialogTitle>
						<AlertDialogDescription>
							确定要删除成员「{memberToDelete?.name}」吗？此操作无法撤销。
						</AlertDialogDescription>
					</AlertDialogHeader>
					{deleteError && (
						<div className="flex items-center gap-2 text-sm text-destructive">
							<AlertCircle className="h-4 w-4" />
							<span>{deleteError}</span>
						</div>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel>取消</AlertDialogCancel>
						<AlertDialogAction onClick={handleDeleteConfirm} variant="destructive">
							删除
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</AppShell>
	);
}
