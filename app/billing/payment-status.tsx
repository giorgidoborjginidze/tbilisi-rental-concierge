"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SeverityIcon } from "../alert-icon";

// After the payment page: while the bank has not confirmed yet, the page
// re-reads the order every 3 seconds for up to a minute (the verified
// server callback is what changes it), then says plainly that it is still
// waiting and not to pay twice.
const EVERY_MS = 3_000;
const FOR_MS = 60_000;

export default function PaymentPending({ waiting, long }: { waiting: string; long: string }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started >= FOR_MS) {
        clearInterval(timer);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, EVERY_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="alert-card alert-card--info" role="status" aria-live="polite">
      <div className="alert-card__notice">
        <SeverityIcon severity="info" />
        <div>{gaveUp ? long : waiting}</div>
      </div>
    </div>
  );
}
