import type { MetadataRoute } from "next";

// Lets Activo be added to a phone's home screen — on an iPhone that is
// what turns on its notifications (Settings → Notifications).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Activo",
    short_name: "Activo",
    description: "Activo — property, car and portfolio management",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
