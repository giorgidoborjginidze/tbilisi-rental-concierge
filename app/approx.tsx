import { IconApprox } from "./icons";

// "≈" in front of a figure that rests partly on a last known or purchase
// price. The icon is for the eye; the word is for a screen reader.
export default function Approx({ label }: { label: string }) {
  return (
    <span className="approx" title={label}>
      <IconApprox />
      <span className="sr-only">{label}</span>
    </span>
  );
}
