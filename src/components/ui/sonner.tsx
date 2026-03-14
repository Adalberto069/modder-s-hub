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
            "group toast group-[.toaster]:bg-[#0a0a0c]/90 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-white/10 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl font-sans",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
          actionButton: "group-[.toast]:bg-neon-purple group-[.toast]:text-white group-[.toast]:font-black group-[.toast]:uppercase group-[.toast]:tracking-widest group-[.toast]:text-[10px]",
          cancelButton: "group-[.toast]:bg-white/5 group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:border-neon-green/30 group-[.toaster]:shadow-neon-green/10",
          error: "group-[.toaster]:border-destructive/30 group-[.toaster]:shadow-destructive/10",
          info: "group-[.toaster]:border-neon-purple/30 group-[.toaster]:shadow-neon-purple/10",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
