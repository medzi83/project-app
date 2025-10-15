"use client";

type DeleteTriggerButtonProps = {
  triggerId: string;
  triggerName: string;
  deleteTrigger: (formData: FormData) => void;
};

export function DeleteTriggerButton({
  triggerId,
  triggerName,
  deleteTrigger,
}: DeleteTriggerButtonProps) {
  return (
    <form action={deleteTrigger}>
      <input type="hidden" name="id" value={triggerId} />
      <button
        type="submit"
        className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
        onClick={(e) => {
          if (!confirm(`Trigger "${triggerName}" wirklich löschen?`)) {
            e.preventDefault();
          }
        }}
      >
        Löschen
      </button>
    </form>
  );
}
