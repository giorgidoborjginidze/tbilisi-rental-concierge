"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Submit a form to its action WITHOUT React's automatic form reset. React
 * resets a <form action={fn}> after every action — even one that returned
 * an error — and that reset puts a controlled <select> back on its first
 * option while the component still believes it holds the chosen value (a
 * monthly lease came back as daily). Forms whose fields are partly
 * controlled submit through this instead: nothing typed or chosen moves,
 * and useFormStatus still sees the pending state. The form keeps its
 * `action` for the no-JavaScript fallback.
 */
export function keepTyped(dispatch: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter ?? null;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(data));
  };
}
