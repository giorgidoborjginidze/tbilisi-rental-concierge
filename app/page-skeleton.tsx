// What a page looks like while it is on the way: its shape in soft blocks,
// shown the moment a tab or link is tapped (the route's loading.tsx), so
// the phone answers at once instead of holding the old page until the new
// one is ready. No data and no cookies — Next prefetches it with the route.

type Variant = "dashboard" | "cards" | "calendar" | "list" | "table" | "form" | "detail";

const Block = ({ h, w, className = "" }: { h: number; w?: string; className?: string }) => (
  <div className={`skel__block ${className}`} style={{ height: h, width: w }} />
);

export default function PageSkeleton({ variant }: { variant: Variant }) {
  return (
    <main className="skel" aria-busy="true">
      {/* Both languages: this shell is the same for every visitor. */}
      <span className="sr-only" role="status">
        იტვირთება… · Loading…
      </span>
      {(variant === "calendar" || variant === "table") && (
        <div className="skel__row">
          <Block h={30} w="84px" className="skel__pill" />
          <Block h={30} w="96px" className="skel__pill" />
          <Block h={30} w="90px" className="skel__pill" />
        </div>
      )}
      <Block h={26} w="min(260px, 60%)" className="skel__title" />
      {variant === "dashboard" && (
        <>
          <Block h={150} className="skel__card" />
          <Block h={210} className="skel__card" />
          <Block h={180} className="skel__card" />
        </>
      )}
      {variant === "cards" && (
        <>
          <Block h={96} className="skel__card" />
          <div className="skel__grid">
            {Array.from({ length: 6 }, (_, i) => (
              <Block key={i} h={230} className="skel__card" />
            ))}
          </div>
        </>
      )}
      {variant === "calendar" && (
        <>
          <Block h={18} w="min(420px, 90%)" />
          <Block h={380} className="skel__card" />
        </>
      )}
      {(variant === "list" || variant === "detail") && (
        <>
          {variant === "list" && (
            <div className="skel__row">
              <Block h={30} w="80px" className="skel__pill" />
              <Block h={30} w="100px" className="skel__pill" />
              <Block h={30} w="96px" className="skel__pill" />
            </div>
          )}
          {Array.from({ length: variant === "list" ? 5 : 3 }, (_, i) => (
            <Block key={i} h={variant === "list" ? 72 : 150} className="skel__card" />
          ))}
        </>
      )}
      {variant === "table" && <Block h={420} className="skel__card" />}
      {variant === "form" && (
        <div className="skel__form">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i}>
              <Block h={12} w="120px" />
              <Block h={42} className="skel__field" />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
