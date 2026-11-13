import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar · Cartise CRM" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image src="/brand/cartise-logo.svg" alt="Cartise" width={150} height={41} priority />
          <p className="text-sm text-ink-3">CRM interno · Gonçalo &amp; Tomás</p>
        </div>
        <div className="rounded-3xl bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_30px_rgba(0,0,0,.05)]">
          <h1 className="mb-5 font-display text-xl font-semibold tracking-tight">Entrar</h1>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
