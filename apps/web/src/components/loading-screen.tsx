/**
 * Full-screen loading overlay with orbital spinner around the app logo.
 * Based on basalt LoadingPage template.
 */
export default function LoadingScreen() {
	return (
		<div className="flex min-h-basalt-80 flex-1 items-center justify-center motion-safe:animate-fade-up">
			<div className="relative">
				<div className="flex h-72 w-72 items-center justify-center rounded-full bg-basalt-secondary dark:bg-[#171717] ring-1 ring-basalt-border overflow-hidden p-6">
					<img
						src="/logo-256.png"
						alt="Surety"
						width={112}
						height={112}
						className="h-28 w-28 object-contain"
					/>
				</div>
				{/* Orbital spinner — overlays the circle edge */}
				<div className="absolute inset-[-4px] rounded-full border-[3px] border-transparent border-t-primary animate-spin" />
			</div>
		</div>
	);
}
