import { GroupForm } from "@/components/GroupForm";
import { PageTitle } from "@/components/ui";
import { createGroup } from "@/app/actions/groups";

export const metadata = { title: "Nová skupina" };

export default function NewGroup() {
  return (
    <>
      <PageTitle title="Nová skupina" />
      <div className="card max-w-3xl">
        <GroupForm action={createGroup} withRules submitLabel="Vytvoriť skupinu" />
      </div>
    </>
  );
}
