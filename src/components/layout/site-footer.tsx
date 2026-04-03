/**
 * Site footer component for public pages (login, landing, etc.).
 *
 * B-1 compliance: Reusable SiteFooter component.
 */

interface SiteFooterProps {
  projectName?: string;
  projectUrl?: string;
}

export function SiteFooter({
  projectName = "surety",
  projectUrl = "https://github.com/nocoo/surety",
}: SiteFooterProps) {
  return (
    <footer className="py-4 text-center">
      <p className="text-xs text-muted-foreground">
        Powered by{" "}
        <a
          href={projectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 transition-colors"
        >
          {projectName}
        </a>
      </p>
    </footer>
  );
}
