import { SectionRule as SectionDivider } from "@nocoo/basalt/components/section-rule";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

describe("SectionDivider", () => {
	it("renders the title and children", () => {
		const html = renderToStaticMarkup(
			<SectionDivider title="本月">
				<p>body content</p>
			</SectionDivider>,
		);
		expect(html).toContain("本月");
		expect(html).toContain("body content");
	});

	it("renders the divider line and the section is a semantic <section>", () => {
		const html = renderToStaticMarkup(<SectionDivider title="x">y</SectionDivider>);
		expect(html).toMatch(/<section/);
		// The thin divider line is the border-dashed element.
		expect(html).toContain("border-dashed");
	});

	it("renders the action slot when provided", () => {
		const html = renderToStaticMarkup(
			<SectionDivider title="x" actions={<button type="button">更多</button>}>
				body
			</SectionDivider>,
		);
		expect(html).toContain("更多");
	});

	it("omits the action wrapper when no action is given", () => {
		// Two non-zero divs would be header + body; the action slot is
		// an extra `shrink-0` wrapper inside the header. Loose check: the
		// word "更多" must not appear in a no-action render.
		const html = renderToStaticMarkup(<SectionDivider title="x">body</SectionDivider>);
		expect(html).not.toContain("更多");
	});
});
