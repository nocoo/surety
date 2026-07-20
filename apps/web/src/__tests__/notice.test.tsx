import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Notice } from "@/components/ui/notice";

describe("Notice", () => {
	it("renders default info variant when no variant supplied", () => {
		const html = renderToStaticMarkup(<Notice>hello</Notice>);
		expect(html).toContain("hello");
		expect(html).toContain('role="status"');
		expect(html).toContain("border-info/30");
		expect(html).toContain("bg-info/10");
		expect(html).toContain("text-info-text");
	});

	it("applies semantic-token classes for each variant", () => {
		const variants = ["info", "success", "warning", "destructive"] as const;
		for (const v of variants) {
			const html = renderToStaticMarkup(<Notice variant={v}>x</Notice>);
			expect(html).toContain(`border-${v}/30`);
			expect(html).toContain(`bg-${v}/10`);
			// Body color uses the dedicated *-text token (not the fill token),
			// because fill tokens fail WCAG AA when used as foreground on
			// body backgrounds.
			expect(html).toContain(`text-${v}-text`);
			expect(html).not.toMatch(new RegExp(`text-${v}(?!-text)\\b`));
		}
	});

	it("forwards custom className", () => {
		const html = renderToStaticMarkup(<Notice className="custom-x">x</Notice>);
		expect(html).toContain("custom-x");
	});
});
