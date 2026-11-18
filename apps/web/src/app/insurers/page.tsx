import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Badge,
	Button,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@nocoo/basalt/components/table";
import { FileText, Globe, Pencil, Phone, Plus, Trash2 } from "@nocoo/basalt/icons";
import { useEffect, useState } from "react";
import { InsurersPageSkeleton } from "@/components/skeletons";
import { apiFetch as fetch } from "@/hooks/local-environment";
import { InsurerSheet } from "./insurer-sheet";

interface Insurer {
	id: number;
	name: string;
	phone: string | null;
	website: string | null;
	policyCount?: number;
}

export default function InsurersPage() {
	const [insurers, setInsurers] = useState<Insurer[]>([]);
	const [loading, setLoading] = useState(true);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [editingInsurer, setEditingInsurer] = useState<Insurer | null>(null);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [insurerToDelete, setInsurerToDelete] = useState<Insurer | null>(null);

	const fetchInsurers = () => {
		fetch("/api/insurers")
			.then((res) => res.json())
			.then((data: Insurer[]) => {
				setInsurers(data);
				setLoading(false);
			})
			.catch(() => setLoading(false));
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: mount-only initial fetch
	useEffect(() => {
		fetchInsurers();
	}, []);

	const handleAdd = () => {
		setEditingInsurer(null);
		setSheetOpen(true);
	};

	const handleEdit = (insurer: Insurer) => {
		setEditingInsurer(insurer);
		setSheetOpen(true);
	};

	const handleDeleteClick = (insurer: Insurer) => {
		setInsurerToDelete(insurer);
		setDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = async () => {
		if (!insurerToDelete) return;

		const response = await fetch(`/api/insurers/${insurerToDelete.id}`, {
			method: "DELETE",
		});

		if (response.ok) {
			fetchInsurers();
		}
		setDeleteDialogOpen(false);
		setInsurerToDelete(null);
	};

	if (loading) {
		return <InsurersPageSkeleton />;
	}

	return (
		<>
			<div className="space-y-6">
				<PageHeader
					title="保险公司"
					description={`共 ${insurers.length} 家保险公司`}
					actions={
						<Button onClick={handleAdd}>
							<Plus className="mr-2 h-4 w-4" />
							添加保险公司
						</Button>
					}
				/>

				<div className="rounded-basalt-card bg-basalt-secondary ring-1 ring-basalt-border/80 shadow-basalt-card">
					<div data-slot="table-container" className="overflow-x-auto">
						<Table className="min-w-[660px]">
							<TableHeader>
								<TableRow>
									<TableHead>名称</TableHead>
									<TableHead>客服电话</TableHead>
									<TableHead>官方网站</TableHead>
									<TableHead className="text-center">保单数</TableHead>
									<TableHead className="w-[100px]">操作</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{insurers.length === 0 ? (
									<TableRow>
										<TableCell colSpan={5} className="h-24 text-center">
											<div className="text-basalt-muted-foreground">
												暂无保险公司，点击上方按钮添加
											</div>
										</TableCell>
									</TableRow>
								) : (
									insurers.map((insurer) => (
										<TableRow key={insurer.id}>
											<TableCell>
												<span className="font-medium">{insurer.name}</span>
											</TableCell>
											<TableCell>
												{insurer.phone ? (
													<a
														href={`tel:${insurer.phone}`}
														className="inline-flex items-center gap-1.5 hover:underline"
													>
														<Phone className="h-3.5 w-3.5 text-basalt-primary" />
														{insurer.phone}
													</a>
												) : (
													<Badge variant="outline" className="text-basalt-muted-foreground">
														未设置
													</Badge>
												)}
											</TableCell>
											<TableCell>
												{insurer.website ? (
													<a
														href={insurer.website}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex items-center gap-1.5 hover:underline"
													>
														<Globe className="h-3.5 w-3.5 text-basalt-primary" />
														{new URL(insurer.website).hostname}
													</a>
												) : (
													<span className="text-basalt-muted-foreground">-</span>
												)}
											</TableCell>
											<TableCell className="text-center">
												{insurer.policyCount && insurer.policyCount > 0 ? (
													<div className="flex items-center justify-center gap-1">
														<FileText className="h-3 w-3 text-basalt-primary" />
														<span className="text-sm">{insurer.policyCount}</span>
													</div>
												) : (
													<span className="text-basalt-muted-foreground">-</span>
												)}
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-1">
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8"
														onClick={() => handleEdit(insurer)}
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
																		className="h-8 w-8 text-basalt-destructive hover:text-basalt-destructive"
																		disabled={(insurer.policyCount ?? 0) > 0}
																		onClick={() => handleDeleteClick(insurer)}
																		aria-label={
																			(insurer.policyCount ?? 0) > 0
																				? "已有保单关联，无法删除保险公司"
																				: "删除保险公司"
																		}
																	>
																		<Trash2 className="h-4 w-4" />
																		<span className="sr-only">删除</span>
																	</Button>
																</span>
															</TooltipTrigger>
															{(insurer.policyCount ?? 0) > 0 && (
																<TooltipContent>已有保单关联，无法删除</TooltipContent>
															)}
														</Tooltip>
													</TooltipProvider>
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</div>
			</div>

			<InsurerSheet
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				insurer={editingInsurer}
				onSuccess={fetchInsurers}
			/>

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>确认删除</AlertDialogTitle>
						<AlertDialogDescription>
							确定要删除保险公司「{insurerToDelete?.name}」吗？此操作无法撤销。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>取消</AlertDialogCancel>
						<AlertDialogAction onClick={handleDeleteConfirm}>删除</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
