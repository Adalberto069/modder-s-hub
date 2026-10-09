import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell flex min-h-screen flex-col">
      <Navbar />
      <main className="site-main min-w-0 flex-1">{children}</main>
      <Footer />
    </div>
  );
}
