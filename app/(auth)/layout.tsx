import { Braces, FileText, Network, Share2 } from "lucide-react";

const features = [
  {
    icon: Network,
    title: "AI Architecture Generation",
    description:
      "Describe your system, AI maps it to nodes and edges on a live canvas.",
  },
  {
    icon: Share2,
    title: "Real-time Collaboration",
    description:
      "Live cursors, presence indicators, and shared node editing across your team.",
  },
  {
    icon: FileText,
    title: "Instant Spec Generation",
    description:
      "Export a complete Markdown technical spec directly from the canvas graph.",
  },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-2">
      <section className="hidden min-h-screen flex-col border-r border-border bg-card px-10 py-8 lg:flex xl:px-16">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20">
            G
          </div>
          <span className="text-sm font-semibold text-foreground">Polaris</span>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <div className="max-w-[31rem]">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Braces className="h-3.5 w-3.5 text-primary" />
              AI-native architecture workspace
            </div>

            <h1 className="text-4xl font-semibold leading-[1.08] tracking-normal text-foreground xl:text-5xl">
              Design systems at the speed of thought.
            </h1>
            <p className="mt-5 max-w-[28rem] text-base leading-7 text-muted-foreground">
              Describe your architecture in plain English. Polaris maps it to a
              shared canvas your whole team can refine in real time.
            </p>

            <div className="mt-12 space-y-6">
              {features.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {title}
                    </p>
                    <p className="mt-1 max-w-[27rem] text-sm leading-6 text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground/80">
          © 2026 Polaris. All rights reserved.
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[25rem]">{children}</div>
      </section>
    </main>
  );
}
