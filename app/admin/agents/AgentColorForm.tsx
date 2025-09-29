"use client";
import { useRef } from "react";
import { updateAgentColor } from "./actions";

type Props = {
  userId: string;
  color?: string | null;
};

export default function AgentColorForm({ userId, color }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const changedRef = useRef(false);
  const skipBlurRef = useRef(false);
  const defaultColor = color ?? "#000000";

  return (
    <form ref={formRef} action={updateAgentColor} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="mode" value="save" />
      <input
        type="color"
        name="color"
        defaultValue={defaultColor}
        className="h-8 w-10 border rounded"
        onChange={() => {
          changedRef.current = true;
        }}
        onBlur={(event) => {
          if (skipBlurRef.current) {
            skipBlurRef.current = false;
            return;
          }
          if (changedRef.current) {
            changedRef.current = false;
            event.currentTarget.form?.requestSubmit();
          }
        }}
        aria-label="Agentenfarbe"
      />
      {color && (
        <button
          className="px-2 py-1 border rounded"
          name="mode"
          value="clear"
          formNoValidate
          title="Farbe entfernen"
          onMouseDown={() => {
            skipBlurRef.current = true;
          }}
        >
          Entfernen
        </button>
      )}
    </form>
  );
}
