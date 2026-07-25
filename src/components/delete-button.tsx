"use client";

import { useFormStatus } from "react-dom";

function Button({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn-danger" disabled={pending}>
      {pending ? "Usuwam…" : label}
    </button>
  );
}

export function DeleteButton({
  action,
  label,
  confirmText,
}: {
  action: () => Promise<void>;
  label: string;
  confirmText: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) {
          event.preventDefault();
        }
      }}
    >
      <Button label={label} />
    </form>
  );
}
