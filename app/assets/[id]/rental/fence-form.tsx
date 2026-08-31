"use client";

import { useActionState, useState } from "react";
import { saveGeofence } from "@/lib/rentals/actions";
import type { FormState } from "@/lib/units/actions";

// Defining a red line. A circle covers most real agreements ("stay within
// 40 km of Tbilisi"); a polygon is there when the boundary really is a
// shape, entered as "lat, lng" per line — the format phone maps copy out.
export default function FenceForm({
  assetId,
  labels,
}: {
  assetId: string;
  labels: Record<string, string>;
}) {
  const [state, save, saving] = useActionState<FormState, FormData>(
    saveGeofence,
    null,
  );
  const [kind, setKind] = useState<"circle" | "polygon">("circle");
  const [center, setCenter] = useState({ lat: "", lng: "" });
  const [locating, setLocating] = useState(false);

  const useMyPosition = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
        });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <form action={save} className="card form-grid" style={{ padding: 18 }}>
      <input type="hidden" name="assetId" value={assetId} />

      <label className="field">
        {labels.fence_name}
        <input name="name" required placeholder="Tbilisi 40 km" />
      </label>

      <label className="field">
        {labels.fence_kind}
        <select
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as "circle" | "polygon")}
        >
          <option value="circle">{labels.fence_circle}</option>
          <option value="polygon">{labels.fence_polygon}</option>
        </select>
      </label>

      {kind === "circle" ? (
        <>
          <label className="field">
            {labels.fence_center}
            <div className="field-row">
              <input
                name="centerLat"
                type="number"
                step="any"
                required
                placeholder="41.7151"
                value={center.lat}
                onChange={(event) =>
                  setCenter((prev) => ({ ...prev, lat: event.target.value }))
                }
              />
              <input
                name="centerLng"
                type="number"
                step="any"
                required
                placeholder="44.8271"
                value={center.lng}
                onChange={(event) =>
                  setCenter((prev) => ({ ...prev, lng: event.target.value }))
                }
              />
            </div>
          </label>
          <label className="field">
            {labels.fence_radius}
            <input name="radiusKm" type="number" min={0.1} step="0.1" required defaultValue={40} />
          </label>
          <div className="col-span-2">
            <button
              type="button"
              className="btn-chip"
              onClick={useMyPosition}
              disabled={locating}
            >
              📍 {labels.fence_use_location}
            </button>
          </div>
        </>
      ) : (
        <label className="field col-span-2">
          {labels.fence_points}
          <textarea
            name="points"
            rows={5}
            required
            placeholder={"41.80, 44.70\n41.80, 44.95\n41.62, 44.95\n41.62, 44.70"}
          />
          <span className="field-hint">{labels.fence_points_hint}</span>
        </label>
      )}

      <label className="field">
        {labels.fence_approach}
        <input name="approachKm" type="number" min={0.1} step="0.1" defaultValue={1} />
      </label>
      <p className="field-hint col-span-2">{labels.fence_approach_hint}</p>

      {state?.error && <p className="form-error col-span-2">{labels[state.error]}</p>}
      <div className="col-span-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {labels.fence_add}
        </button>
      </div>
    </form>
  );
}
