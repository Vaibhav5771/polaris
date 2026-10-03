import Image from "next/image";
import { FileText, Network, Share2 } from "lucide-react";
import { BeamsBackground } from "@/components/auth/beams-background";

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
          <Image
            src="/logo.png"
            alt="Polaris logo"
            width={56}
            height={56}
            priority
            className="h-14 w-14 shrink-0 rounded-xl shadow-sm shadow-primary/20"
          />

          <span className="font-brand text-base font-semibold tracking-tight text-foreground">
            Polaris
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <div className="max-w-[31rem]">
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
      </section>

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-8">
        <BeamsBackground intensity="subtle" />
        <div className="relative z-10 w-full max-w-[25rem]">{children}</div>
      </section>
    </main>
  );
}
