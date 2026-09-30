import PageSkeleton from "../page-skeleton";

// Shown the moment Home is tapped by a signed-in owner ("/" is rewritten
// here), until the dashboard is ready.
export default function Loading() {
  return <PageSkeleton variant="dashboard" />;
}
