import Link from "next/link";
import { Shell, Empty } from "@/components/ui";

export default function NotFound() {
  return (
    <Shell narrow>
      <Empty title="Stránka sa nenašla">
        <Link href="/" className="btn-primary mt-4">Späť domov</Link>
      </Empty>
    </Shell>
  );
}
