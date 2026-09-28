import { SegmentControl } from "@nocoo/basalt/components/segment-control";
import { useState } from "react";
import { type LocalMode, localEnvironment, switchEnvironment } from "@/hooks/local-environment";

export function EnvironmentSelector() {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	if (!localEnvironment?.visible) return null;
	return (
		<div className="flex items-center gap-2">
			<SegmentControl
				className="[&>legend]:sr-only [&_[data-slot=segment-control-viewport]]:pb-0"
				legend={<span className="sr-only">运行环境</span>}
				value={localEnvironment.mode}
				disabled={pending || localEnvironment.locked}
				options={[
					{ value: "demo", label: "Demo" },
					{ value: "e2e", label: "E2E" },
					{ value: "prod", label: "Prod" },
				]}
				onValueChange={(mode) => {
					setPending(true);
					setError("");
					void switchEnvironment(mode as LocalMode)
						.catch((reason: Error) => setError(reason.message))
						.finally(() => setPending(false));
				}}
			/>
			{error && (
				<span role="alert" className="text-xs text-destructive">
					{error}
				</span>
			)}
		</div>
	);
}
