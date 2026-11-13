import Image from "next/image";
import { signOut } from "@/app/login/actions";

export const metadata = { title: "Sem acesso · Cartise CRM" };

export default function NoAccessPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div className="max-w-sm space-y-4">
        <Image src="/brand/cartise-logo.svg" alt="Cartise" width={130} height={36} className="mx-auto" />
        <p className="text-ink-2">Esta conta não faz parte da equipa Cartise.</p>
        <form action={signOut}>
          <button className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">Sair</button>
        </form>
      </div>
    </main>
  );
}
