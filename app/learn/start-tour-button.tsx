"use client";

import { useRouter } from "next/navigation";
import { startTour } from "../tour";

// Starts the guided tour from the Learn page: arms it, then jumps to the
// dashboard where the first step lives. Signed-out visitors are sent to
// sign in instead — every step points at a signed-in screen.
export default function StartTourButton({
  signedIn,
  label,
  hint,
}: {
  signedIn: boolean;
  label: string;
  hint: string;
}) {
  const router = useRouter();

  if (!signedIn) {
    return (
      <div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => router.push("/login")}
        >
          {label}
        </button>
        <p className="hint" style={{ marginTop: 8 }}>{hint}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="btn-primary"
      onClick={() => {
        startTour();
        router.push("/");
      }}
    >
      {label}
    </button>
  );
}
