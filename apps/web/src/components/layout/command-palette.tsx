import {
	Building2,
	CalendarClock,
	FileText,
	Hospital,
	Landmark,
	LayoutDashboard,
	type LucideIcon,
	Plus,
	Search,
	Settings,
	ShieldCheck,
	Stethoscope,
	UserRound,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import useSWR from "swr";
import { fetchAPI } from "@/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Cmd+K / Ctrl+K command palette. Built locally instead of pulling
 * in `cmdk` because the project is otherwise dependency-lean and the
 * UX surface we need is small: fuzzy substring match + arrow-key
 * navigation + Enter to fire + Esc to close.
 *
 * Command sources:
 * - Static navigation (every sidebar entry as a "Go to …" command).
 * - Static "新增 …" actions for the four CRUD targets (saves a click
 *   over navigating then hunting for the page header button).
 * - Live data fetched lazily *only when the palette opens* — policies,
 *   members, hospitals, doctors — so the first-render cost is zero.
 *   SWR caches each list for 60s; reopening within a minute is instant.
 */
export function CommandPalette() {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const isMeta = e.metaKey || e.ctrlKey;
			if (isMeta && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setOpen((v) => !v);
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
				<DialogTitle className="sr-only">命令面板</DialogTitle>
				<PaletteContent onClose={() => setOpen(false)} active={open} />
			</DialogContent>
		</Dialog>
	);
}

interface PaletteCommand {
	id: string;
	/** First line — the searchable text the user is typing toward. */
	label: string;
	/** Optional second line for disambiguation, e.g. "保单 · 张伟". */
	hint?: string;
	/** Group header inserted before the first command of a new section. */
	group: string;
	icon: LucideIcon;
	perform: (nav: ReturnType<typeof useNavigate>) => void;
}

interface PolicyLite {
	id: number;
	productName: string;
	insuredName: string;
	insurerName: string;
}
interface MemberLite {
	id: number;
	name: string;
	relation?: string;
}
interface HospitalLite {
	id: number;
	name: string;
}
interface DoctorLite {
	id: number;
	name: string;
	hospitalName?: string | null;
}

function PaletteContent({ onClose, active }: { onClose: () => void; active: boolean }) {
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	// Reset query and focus the input every time the palette opens.
	useEffect(() => {
		if (active) {
			setQuery("");
			setSelectedIndex(0);
			// Use a microtask so the Dialog has finished mounting the input.
			queueMicrotask(() => inputRef.current?.focus());
		}
	}, [active]);

	// Lazy fetches — `active && true` is the key, so SWR only fires when
	// the palette is open. dedupingInterval keeps reopens within 60s
	// instant.
	const swrCfg = { revalidateOnFocus: false, dedupingInterval: 60_000 };
	const { data: policies } = useSWR<PolicyLite[]>(
		active ? "/api/policies" : null,
		fetchAPI,
		swrCfg,
	);
	const { data: members } = useSWR<MemberLite[]>(active ? "/api/members" : null, fetchAPI, swrCfg);
	const { data: hospitals } = useSWR<HospitalLite[]>(
		active ? "/api/hospitals" : null,
		fetchAPI,
		swrCfg,
	);
	const { data: doctors } = useSWR<DoctorLite[]>(active ? "/api/doctors" : null, fetchAPI, swrCfg);

	const allCommands: PaletteCommand[] = useMemo(() => {
		return [
			...NAV_COMMANDS,
			...NEW_ACTIONS,
			...(policies ?? []).map(
				(p): PaletteCommand => ({
					id: `policy-${p.id}`,
					label: p.productName,
					hint: `保单 · ${p.insuredName} · ${p.insurerName}`,
					group: "保单",
					icon: FileText,
					perform: (nav) => nav(`/policies/${p.id}`),
				}),
			),
			...(members ?? []).map(
				(m): PaletteCommand => ({
					id: `member-${m.id}`,
					label: m.name,
					hint: m.relation ? `家庭成员 · ${m.relation}` : "家庭成员",
					group: "家庭成员",
					icon: UserRound,
					perform: (nav) => nav(`/coverage-lookup?member=${m.id}`),
				}),
			),
			...(hospitals ?? []).map(
				(h): PaletteCommand => ({
					id: `hospital-${h.id}`,
					label: h.name,
					hint: "医院",
					group: "医院",
					icon: Hospital,
					perform: (nav) => nav(`/hospitals`),
				}),
			),
			...(doctors ?? []).map(
				(d): PaletteCommand => ({
					id: `doctor-${d.id}`,
					label: d.name,
					hint: d.hospitalName ? `医生 · ${d.hospitalName}` : "医生",
					group: "医生",
					icon: Stethoscope,
					perform: (nav) => nav(`/doctors`),
				}),
			),
		];
	}, [policies, members, hospitals, doctors]);

	const filtered = useMemo(() => filterCommands(allCommands, query), [allCommands, query]);

	// Clamp selection if the filtered list shortens.
	useEffect(() => {
		if (selectedIndex >= filtered.length) setSelectedIndex(0);
	}, [filtered.length, selectedIndex]);

	function fire(cmd: PaletteCommand | undefined) {
		if (!cmd) return;
		cmd.perform(navigate);
		onClose();
	}

	function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setSelectedIndex((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			fire(filtered[selectedIndex]);
		}
	}

	return (
		<div className="flex flex-col">
			<div className="flex items-center gap-2 border-b border-border px-4 py-3">
				<Search className="h-4 w-4 text-muted-foreground" />
				<input
					ref={inputRef}
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setSelectedIndex(0);
					}}
					onKeyDown={onKeyDown}
					placeholder="搜索保单 / 成员 / 医院 / 医生，或输入命令…"
					className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
				/>
				<kbd className="hidden sm:inline-flex h-5 select-none items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
					esc
				</kbd>
			</div>

			<div className="max-h-[60vh] overflow-y-auto py-1">
				{filtered.length === 0 ? (
					<div className="px-4 py-10 text-center text-sm text-muted-foreground">没有匹配的结果</div>
				) : (
					renderGroups(filtered, selectedIndex, fire, setSelectedIndex)
				)}
			</div>
		</div>
	);
}

function renderGroups(
	filtered: PaletteCommand[],
	selectedIndex: number,
	fire: (cmd: PaletteCommand | undefined) => void,
	setSelectedIndex: (i: number) => void,
) {
	let lastGroup: string | null = null;
	return filtered.map((cmd, i) => {
		const header = cmd.group !== lastGroup ? cmd.group : null;
		lastGroup = cmd.group;
		return (
			<div key={cmd.id}>
				{header && (
					<div className="px-3 pt-2 pb-1 text-[11px] font-medium text-muted-foreground/70">
						{header}
					</div>
				)}
				<button
					type="button"
					role="option"
					aria-selected={i === selectedIndex}
					onMouseMove={() => setSelectedIndex(i)}
					onClick={() => fire(cmd)}
					className={cn(
						"flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
						i === selectedIndex ? "bg-accent text-foreground" : "hover:bg-accent/50",
					)}
				>
					<cmd.icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
					<div className="flex-1 min-w-0">
						<p className="truncate">{cmd.label}</p>
						{cmd.hint && <p className="truncate text-xs text-muted-foreground">{cmd.hint}</p>}
					</div>
				</button>
			</div>
		);
	});
}

/**
 * Case-insensitive substring filter over label + hint + group. Order
 * preserved (already grouped semantically). Exported for tests so the
 * matching behavior — including substring-anywhere, hint matches, and
 * empty-query passthrough — is pinned down without spinning up React.
 */
export function filterCommands(commands: PaletteCommand[], rawQuery: string): PaletteCommand[] {
	const q = rawQuery.trim().toLowerCase();
	if (!q) return commands;
	return commands.filter((c) => {
		const hay = `${c.label} ${c.hint ?? ""} ${c.group}`.toLowerCase();
		return hay.includes(q);
	});
}

const NAV_COMMANDS: PaletteCommand[] = [
	{
		id: "nav-dashboard",
		label: "去仪表盘",
		group: "导航",
		icon: LayoutDashboard,
		perform: (n) => n("/"),
	},
	{
		id: "nav-coverage",
		label: "去保障速查",
		group: "导航",
		icon: ShieldCheck,
		perform: (n) => n("/coverage-lookup"),
	},
	{
		id: "nav-calendar",
		label: "去续保日历",
		group: "导航",
		icon: CalendarClock,
		perform: (n) => n("/renewal-calendar"),
	},
	{
		id: "nav-policies",
		label: "去保单管理",
		group: "导航",
		icon: FileText,
		perform: (n) => n("/policies"),
	},
	{
		id: "nav-members",
		label: "去家庭成员",
		group: "导航",
		icon: Users,
		perform: (n) => n("/members"),
	},
	{
		id: "nav-insurers",
		label: "去保险公司",
		group: "导航",
		icon: Landmark,
		perform: (n) => n("/insurers"),
	},
	{
		id: "nav-assets",
		label: "去资产管理",
		group: "导航",
		icon: Building2,
		perform: (n) => n("/assets"),
	},
	{
		id: "nav-visits",
		label: "去就诊记录",
		group: "导航",
		icon: Stethoscope,
		perform: (n) => n("/medical-visits"),
	},
	{
		id: "nav-hospitals",
		label: "去医院管理",
		group: "导航",
		icon: Hospital,
		perform: (n) => n("/hospitals"),
	},
	{
		id: "nav-doctors",
		label: "去医生管理",
		group: "导航",
		icon: UserRound,
		perform: (n) => n("/doctors"),
	},
	{
		id: "nav-settings",
		label: "去系统设置",
		group: "导航",
		icon: Settings,
		perform: (n) => n("/settings"),
	},
];

const NEW_ACTIONS: PaletteCommand[] = [
	// The new-* routes are hash-flags that the destination page reads on
	// mount to auto-open its create sheet — cheaper than threading a
	// global event bus across the app.
	{
		id: "new-policy",
		label: "新增保单",
		hint: "Plus · Policy",
		group: "快捷操作",
		icon: Plus,
		perform: (n) => n("/policies?new=1"),
	},
	{
		id: "new-member",
		label: "新增家庭成员",
		hint: "Plus · Member",
		group: "快捷操作",
		icon: Plus,
		perform: (n) => n("/members?new=1"),
	},
	{
		id: "new-visit",
		label: "新增就诊记录",
		hint: "Plus · Visit",
		group: "快捷操作",
		icon: Plus,
		perform: (n) => n("/medical-visits?new=1"),
	},
	{
		id: "new-asset",
		label: "新增资产",
		hint: "Plus · Asset",
		group: "快捷操作",
		icon: Plus,
		perform: (n) => n("/assets?new=1"),
	},
];

// Surface for tests.
export const __test__ = { NAV_COMMANDS, NEW_ACTIONS };
