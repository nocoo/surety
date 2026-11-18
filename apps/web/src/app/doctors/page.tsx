import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Avatar,
	AvatarFallback,
	Badge,
	Button,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@nocoo/basalt/components/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@nocoo/basalt/components/table";
import {
	AlertCircle,
	Building2,
	Pencil,
	Phone,
	Plus,
	Stethoscope,
	Trash2,
} from "@nocoo/basalt/icons";
import { useEffect, useMemo, useState } from "react";
import { TablePageSkeleton } from "@/components/skeletons";
import { apiFetch as fetch } from "@/hooks/local-environment";
import { cn, getAvatarColor } from "@/lib/utils";
import { DoctorSheet } from "./doctor-sheet";

interface Hospital {
	id: number;
	name: string;
}

interface Doctor {
	id: number;
	name: string;
	hospitalId: number;
	hospitalName?: string;
	department: string | null;
	title: string | null;
	specialty: string | null;
	phone: string | null;
	notes: string | null;
	visitCount?: number;
}

export default function DoctorsPage() {
	const [doctors, setDoctors] = useState<Doctor[]>([]);
	const [hospitals, setHospitals] = useState<Hospital[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [doctorToDelete, setDoctorToDelete] = useState<Doctor | null>(null);
	const [filterHospitalId, setFilterHospitalId] = useState<string>("all");

	const filteredDoctors = useMemo(() => {
		if (filterHospitalId === "all") return doctors;
		return doctors.filter((d) => d.hospitalId === Number(filterHospitalId));
	}, [doctors, filterHospitalId]);

	const fetchData = () => {
		Promise.all([
			fetch("/api/doctors").then((res) => {
				if (!res.ok) throw new Error("FETCH_FAILED");
				return res.json();
			}),
			fetch("/api/hospitals").then((res) => {
				if (!res.ok) throw new Error("FETCH_FAILED");
				return res.json();
			}),
		])
			.then(([doctorsData, hospitalsData]: [Doctor[], Hospital[]]) => {
				// Enrich doctors with hospital names
				const hospitalMap = new Map(hospitalsData.map((h) => [h.id, h.name]));
				const enrichedDoctors = doctorsData.map((d) => ({
					...d,
					hospitalName: hospitalMap.get(d.hospitalId) ?? "未知医院",
				}));
				setDoctors(enrichedDoctors);
				setHospitals(hospitalsData);
				setError(null);
				setLoading(false);
			})
			.catch(() => {
				setError("加载医生列表失败，请刷新页面重试");
				setLoading(false);
			});
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: mount-only initial fetch
	useEffect(() => {
		fetchData();
	}, []);

	const handleAdd = () => {
		setEditingDoctor(null);
		setSheetOpen(true);
	};

	const handleEdit = (doctor: Doctor) => {
		setEditingDoctor(doctor);
		setSheetOpen(true);
	};

	const handleDeleteClick = (doctor: Doctor) => {
		setDoctorToDelete(doctor);
		setDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = async () => {
		if (!doctorToDelete) return;

		setDeleteError(null);
		try {
			const response = await fetch(`/api/doctors/${doctorToDelete.id}`, {
				method: "DELETE",
			});

			if (response.ok) {
				setDeleteDialogOpen(false);
				setDoctorToDelete(null);
				fetchData();
			} else {
				const data = await response.json().catch(() => null);
				setDeleteError(data?.error ?? "删除医生失败，请重试");
			}
		} catch {
			setDeleteError("网络异常，请检查连接后重试");
		}
	};

	if (loading) {
		return <TablePageSkeleton rows={6} columns={8} />;
	}

	if (error) {
		return (
			<div className="rounded-basalt-card bg-basalt-secondary ring-1 ring-basalt-border/80 shadow-basalt-card p-8 text-center">
				<AlertCircle className="mx-auto h-12 w-12 text-basalt-destructive/50" />
				<h3 className="mt-4 text-lg font-medium">加载失败</h3>
				<p className="mt-2 text-sm text-basalt-muted-foreground">{error}</p>
			</div>
		);
	}

	return (
		<>
			<div className="space-y-6">
				<PageHeader
					title="医生管理"
					description={
						<>
							共 {doctors.length} 位医生
							{filteredDoctors.length !== doctors.length && (
								<span>，当前筛选显示 {filteredDoctors.length} 位</span>
							)}
						</>
					}
					actions={
						<Button onClick={handleAdd} disabled={hospitals.length === 0}>
							<Plus className="mr-2 h-4 w-4" />
							添加医生
						</Button>
					}
					filters={
						hospitals.length > 0 ? (
							<div className="flex items-center gap-2">
								<span className="text-sm text-basalt-muted-foreground">医院</span>
								<Select value={filterHospitalId} onValueChange={setFilterHospitalId}>
									<SelectTrigger className="w-[200px]">
										<SelectValue placeholder="全部医院" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">全部医院</SelectItem>
										{hospitals.map((hospital) => (
											<SelectItem key={hospital.id} value={String(hospital.id)}>
												{hospital.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						) : undefined
					}
				/>

				{hospitals.length === 0 ? (
					<div className="rounded-basalt-card bg-basalt-secondary ring-1 ring-basalt-border/80 shadow-basalt-card p-8 text-center">
						<Building2 className="mx-auto h-12 w-12 text-basalt-muted-foreground/50" />
						<h3 className="mt-4 text-lg font-medium">请先添加医院</h3>
						<p className="mt-2 text-sm text-basalt-muted-foreground">
							医生需要关联到医院，请先在医院管理中添加医院
						</p>
					</div>
				) : (
					<div className="rounded-basalt-card bg-basalt-secondary ring-1 ring-basalt-border/80 shadow-basalt-card">
						<div data-slot="table-container" className="overflow-x-auto">
							<Table className="min-w-[660px]">
								<TableHeader>
									<TableRow>
										<TableHead>姓名</TableHead>
										<TableHead>医院</TableHead>
										<TableHead>科室</TableHead>
										<TableHead>职称</TableHead>
										<TableHead>专长</TableHead>
										<TableHead>电话</TableHead>
										<TableHead className="text-center">就诊次数</TableHead>
										<TableHead className="w-[100px]">操作</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredDoctors.length === 0 ? (
										<TableRow>
											<TableCell colSpan={8} className="h-24 text-center">
												<div className="text-basalt-muted-foreground">
													{doctors.length === 0
														? "暂无医生，点击上方按钮添加"
														: "没有符合筛选条件的医生"}
												</div>
											</TableCell>
										</TableRow>
									) : (
										filteredDoctors.map((doctor) => (
											<TableRow key={doctor.id}>
												<TableCell>
													<div className="flex items-center gap-2">
														<Avatar className="h-7 w-7">
															<AvatarFallback
																className={cn("text-xs text-white", getAvatarColor(doctor.name))}
															>
																{doctor.name[0]}
															</AvatarFallback>
														</Avatar>
														<span className="font-medium">{doctor.name}</span>
													</div>
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-1.5">
														<Building2 className="h-3.5 w-3.5 text-basalt-muted-foreground" />
														<span className="whitespace-normal">{doctor.hospitalName}</span>
													</div>
												</TableCell>
												<TableCell>
													{doctor.department ? (
														<span>{doctor.department}</span>
													) : (
														<span className="text-basalt-muted-foreground">-</span>
													)}
												</TableCell>
												<TableCell>
													{doctor.title ? (
														<Badge variant="outline">{doctor.title}</Badge>
													) : (
														<span className="text-basalt-muted-foreground">-</span>
													)}
												</TableCell>
												<TableCell>
													{doctor.specialty ? (
														<span className="whitespace-normal">{doctor.specialty}</span>
													) : (
														<span className="text-basalt-muted-foreground">-</span>
													)}
												</TableCell>
												<TableCell>
													{doctor.phone ? (
														<a
															href={`tel:${doctor.phone}`}
															className="inline-flex items-center gap-1.5 hover:underline"
														>
															<Phone className="h-3.5 w-3.5 text-basalt-primary" />
															{doctor.phone}
														</a>
													) : (
														<span className="text-basalt-muted-foreground">-</span>
													)}
												</TableCell>
												<TableCell className="text-center">
													{doctor.visitCount && doctor.visitCount > 0 ? (
														<div className="flex items-center justify-center gap-1">
															<Stethoscope className="h-3 w-3 text-basalt-primary" />
															<span className="text-sm">{doctor.visitCount}</span>
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
															onClick={() => handleEdit(doctor)}
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
																			disabled={(doctor.visitCount ?? 0) > 0}
																			onClick={() => handleDeleteClick(doctor)}
																			aria-label={
																				(doctor.visitCount ?? 0) > 0
																					? "已有就诊记录，无法删除医生"
																					: "删除医生"
																			}
																		>
																			<Trash2 className="h-4 w-4" />
																			<span className="sr-only">删除</span>
																		</Button>
																	</span>
																</TooltipTrigger>
																{(doctor.visitCount ?? 0) > 0 && (
																	<TooltipContent>已有就诊记录，无法删除</TooltipContent>
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
				)}
			</div>

			<DoctorSheet
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				doctor={editingDoctor}
				hospitals={hospitals}
				onSuccess={fetchData}
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
							确定要删除医生「{doctorToDelete?.name}」吗？此操作无法撤销。
						</AlertDialogDescription>
					</AlertDialogHeader>
					{deleteError && (
						<div className="flex items-center gap-2 text-sm text-basalt-destructive">
							<AlertCircle className="h-4 w-4" />
							<span>{deleteError}</span>
						</div>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel>取消</AlertDialogCancel>
						<AlertDialogAction onClick={handleDeleteConfirm}>删除</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
