import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Notice } from "@/components/ui/notice";

describe("Notice", () => {
	it("renders default info variant when no variant supplied", () => {
		const html = renderToStaticMarkup(<Notice>hello</Notice>);
		expect(html).toContain("hello");
		expect(html).toContain('role="status"');
		expect(html).toContain("border-basalt-info/30");
		expect(html).toContain("bg-basalt-info/10");
		expect(html).toContain("text-basalt-info");
	});

	it("applies semantic-token classes for each variant", () => {
		const variants = ["info", "success", "warning", "destructive"] as const;
		for (const v of variants) {
			const html = renderToStaticMarkup(<Notice variant={v}>x</Notice>);
			expect(html).toContain(`border-basalt-${v}/30`);
			expect(html).toContain(`bg-basalt-${v}/10`);
			expect(html).toContain(`text-basalt-${v}`);
		}
	});

	it("forwards custom className", () => {
		const html = renderToStaticMarkup(<Notice className="custom-x">x</Notice>);
		expect(html).toContain("custom-x");
	});
});
