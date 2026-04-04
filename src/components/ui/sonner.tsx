import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-2xl !border-white/12 !text-white/85 !shadow-glass",
          description: "group-[.toast]:!text-white/50",
          actionButton: "group-[.toast]:!bg-blue-500/80 group-[.toast]:!text-white",
          cancelButton: "group-[.toast]:!bg-white/8 group-[.toast]:!text-white/55",
        },
        style: {
          background: "rgba(10,16,32,0.88)",
          backdropFilter: "blur(48px)",
          WebkitBackdropFilter: "blur(48px)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
        } as React.CSSProperties,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
