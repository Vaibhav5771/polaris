import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      appearance={{
        options: {
          socialButtonsVariant: "iconButton",
        },
        elements: {
          rootBox: "w-full",
          cardBox:
            "w-full overflow-hidden rounded-xl border border-border bg-[oklch(0.19_0.005_260)] shadow-2xl shadow-background/40",
          card: "w-full gap-6 bg-[oklch(0.19_0.005_260)] p-8",
          headerTitle: "text-xl font-semibold tracking-normal text-foreground",
          headerSubtitle: "text-sm text-muted-foreground",
          socialButtons:
            "grid grid-cols-2 gap-3 [&:has(>:only-child)]:grid-cols-1",
          socialButtonsBlockButton:
            "h-10 rounded-md border border-border bg-background text-sm font-medium text-foreground hover:bg-secondary",
          dividerLine: "bg-white/15",
          dividerText: "text-xs text-muted-foreground",
          formFieldLabel: "text-sm font-medium text-foreground",
          formFieldInput:
            "h-11 rounded-md border border-input bg-input px-4 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring",
          formButtonPrimary:
            "h-11 rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-none hover:bg-primary/90",
          footer: "rounded-b-xl border-t border-border bg-secondary/40",
          footerActionText: "text-sm text-muted-foreground",
          footerActionLink: "text-sm font-semibold text-primary hover:text-primary",
        },
      }}
    />
  );
}
