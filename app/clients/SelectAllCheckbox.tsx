"use client";

export default function SelectAllCheckbox() {
  return (
    <input
      type="checkbox"
      id="select-all"
      onChange={(e) => {
        const checkboxes = document.querySelectorAll<HTMLInputElement>('input[name="ids"]');
        checkboxes.forEach((cb) => {
          cb.checked = e.currentTarget.checked;
        });
      }}
    />
  );
}
