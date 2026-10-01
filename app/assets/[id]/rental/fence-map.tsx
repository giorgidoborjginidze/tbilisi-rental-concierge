"use client";

// Drawing a red line on the map instead of typing coordinates. For a circle,
// a tap sets its centre (the radius stays in its field and the circle
// follows it); for a polygon, each tap adds a corner. The fields of the
// form stay the source of truth — the map only reads them and writes taps
// back — so a preset, "use my location" or typed numbers show up here too.
// The car's last position and the red lines already saved are drawn for
// orientation. Map: OpenStreetMap tiles through Leaflet (loaded only here).

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { EXAMPLE_POSITION } from "@/lib/geo/presets";

export interface SavedFence {
  name: string;
  kind: "circle" | "polygon";
  centerLat?: number | null;
  centerLng?: number | null;
  radiusKm?: number | null;
  points?: [number, number][];
}

/** "lat, lng" per line → points (bad lines are skipped). */
export function parsePointLines(text: string): [number, number][] {
  return text
    .split(/\n/)
    .map((line) => line.split(/[,;\s]+/).filter(Boolean).map(Number))
    .filter((pair) => pair.length === 2 && pair.every(Number.isFinite))
    .map(([lat, lng]) => [lat, lng] as [number, number]);
}

export default function FenceMap({
  kind,
  center,
  radiusKm,
  points,
  onCenter,
  onAddPoint,
  saved,
  car,
  labels,
}: {
  kind: "circle" | "polygon";
  center: { lat: string; lng: string };
  radiusKm: string;
  points: string;
  onCenter: (lat: number, lng: number) => void;
  onAddPoint: (lat: number, lng: number) => void;
  saved: SavedFence[];
  car: { lat: number; lng: number } | null;
  labels: Record<string, string>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const draft = useRef<LayerGroup | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  // The latest handlers, for the map's click listener set up once.
  const handlers = useRef({ kind, onCenter, onAddPoint });
  // The circle last zoomed to: the map follows a new centre or radius, not every keystroke elsewhere.
  const fitted = useRef("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    handlers.current = { kind, onCenter, onAddPoint };
  });

  // The map itself, once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !box.current || map.current) return;
      leaflet.current = L;
      const start = car ?? EXAMPLE_POSITION;
      const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], car ? 12 : 10);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      // What is already saved, in grey; the car as a dot.
      for (const fence of saved) {
        const style = { color: "#64748b", weight: 2, fillOpacity: 0.05, dashArray: "4 4" };
        if (fence.kind === "circle" && fence.centerLat != null && fence.centerLng != null && fence.radiusKm) {
          L.circle([fence.centerLat, fence.centerLng], { radius: fence.radiusKm * 1000, ...style }).bindTooltip(fence.name).addTo(m);
        } else if (fence.kind === "polygon" && fence.points && fence.points.length >= 3) {
          L.polygon(fence.points, style).bindTooltip(fence.name).addTo(m);
        }
      }
      if (car) {
        L.circleMarker([car.lat, car.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 })
          .bindTooltip(labels.fence_map_car ?? "")
          .addTo(m);
      }
      draft.current = L.layerGroup().addTo(m);
      m.on("click", (event) => {
        const lat = Math.round(event.latlng.lat * 1e6) / 1e6;
        const lng = Math.round(event.latlng.lng * 1e6) / 1e6;
        if (handlers.current.kind === "circle") handlers.current.onCenter(lat, lng);
        else handlers.current.onAddPoint(lat, lng);
      });
      map.current = m;
      // The form opens inside a fold: the map measures again whenever its box changes size.
      const observer = new ResizeObserver(() => m.invalidateSize());
      observer.observe(box.current);
      m.on("unload", () => observer.disconnect());
      setReady(true);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- built once; the draft follows the fields below
  }, []);

  // The red line being drawn, from the form's fields.
  useEffect(() => {
    const L = leaflet.current;
    const layer = draft.current;
    if (!L || !layer) return;
    layer.clearLayers();
    const style = { color: "#dc2626", weight: 3, fillOpacity: 0.08 };
    if (kind === "circle") {
      const lat = Number(center.lat);
      const lng = Number(center.lng);
      const radius = Number(radiusKm);
      if (center.lat !== "" && center.lng !== "" && Number.isFinite(lat) && Number.isFinite(lng)) {
        L.circleMarker([lat, lng], { radius: 5, color: "#dc2626", fillOpacity: 1 }).addTo(layer);
        if (Number.isFinite(radius) && radius > 0) {
          const circle = L.circle([lat, lng], { radius: radius * 1000, ...style }).addTo(layer);
          const key = `${lat},${lng},${radius}`;
          if (fitted.current !== key) {
            fitted.current = key;
            map.current?.fitBounds(circle.getBounds(), { padding: [20, 20], maxZoom: 13 });
          }
        }
      }
    } else {
      const corners = parsePointLines(points);
      for (const corner of corners) L.circleMarker(corner, { radius: 4, color: "#dc2626", fillOpacity: 1 }).addTo(layer);
      if (corners.length >= 3) L.polygon(corners, style).addTo(layer);
      else if (corners.length === 2) L.polyline(corners, style).addTo(layer);
    }
  }, [ready, kind, center.lat, center.lng, radiusKm, points]);

  return (
    <div className="fence-map">
      <div ref={box} className="fence-map__box" role="application" aria-label={labels.fence_map_aria} />
      <p className="field-hint" style={{ margin: "6px 0 0" }}>
        {kind === "circle" ? labels.fence_map_hint_circle : labels.fence_map_hint_polygon}
      </p>
    </div>
  );
}
