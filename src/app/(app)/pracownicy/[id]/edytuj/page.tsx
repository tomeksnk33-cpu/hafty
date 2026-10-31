import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { updateUser } from "../../actions";
import { UserForm } from "../../user-form";

export default async function EditEmployeePage(props: PageProps<"/pracownicy/[id]/edytuj">) {
  const admin = await requireAdmin();
  const { id } = await props.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      login: true,
      role: true,
      canManageRealizations: true,
      canUseEmbroidery: true,
      canUseLaundry: true,
      canUseTimeclock: true,
      canUseAttendance: true,
      active: true,
    },
  });

  if (!user) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edycja konta" subtitle={`${user.name} · ${user.login}`} />
      <UserForm
        action={updateUser.bind(null, user.id)}
        defaults={{
          name: user.name,
          login: user.login,
          role: user.role,
          canManageRealizations: user.canManageRealizations,
          canUseEmbroidery: user.canUseEmbroidery,
          canUseLaundry: user.canUseLaundry,
          canUseTimeclock: user.canUseTimeclock,
          canUseAttendance: user.canUseAttendance,
          active: user.active,
        }}
        mode="edit"
        isSelf={user.id === admin.id}
        submitLabel="Zapisz zmiany"
        cancelHref="/pracownicy"
      />
    </div>
  );
}
