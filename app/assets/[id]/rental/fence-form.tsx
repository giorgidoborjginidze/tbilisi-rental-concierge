"use client";

import { startTransition, useActionState, useState } from "react";
import { saveGeofence } from "@/lib/rentals/actions";
import type { FormState } from "@/lib/units/actions";
import { FENCE_PRESETS, type FencePreset } from "@/lib/geo/presets";
import { IconPin } from "@/app/icons";
import { keepingValues } from "@/lib/forms";

// Defining a red line. Most owners do not know coordinates, so the common
// agreements ("stay within 30 km of Tbilisi", "do not leave Georgia") are
// one tap away; each preset only fills the fields, which stay editable. A
// circle covers most real agreements; a polygon is there when the boundary
// really is a shape, entered as "lat, lng" per line — the format phone
// maps copy out. Validation messages come from the server in the owner's
// language rather than the browser's. The form is submitted by hand (not
// through the form's action prop) so React does not reset the controlled
// shape selector behind the fields' backs; it is cleared after a save.
export default function FenceForm({
  assetId,
  labels,
}: {
  assetId: string;
  labels: Record<string, string>;
}) {
  const [kind, setKind] = useState<"circle" | "polygon">("circle");
  const [name, setName] = useState("");
  const [center, setCenter] = useState({ lat: "", lng: "" });
  const [radius, setRadius] = useState("40");
  const [points, setPoints] = useState("");
  const [preset, setPreset] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const [state, save, saving] = useActionState<FormState, FormData>(
    async (previous, formData) => {
      const result = await keepingValues(saveGeofence)(previous, formData);
      if (!result?.error) {
        // Saved: start the next red line from a clean form.
        setPreset(null);
        setKind("circle");
        setName("");
        setCenter({ lat: "", lng: "" });
        setRadius("40");
        setPoints("");
      }
      return result;
    },
    null,
  );

  const applyPreset = (choice: FencePreset) => {
    setPreset(choice.id);
    setName(labels[`fence_preset_${choice.id}`] ?? choice.id);
    if (choice.kind === "circle") {
      setKind("circle");
      setCenter({ lat: String(choice.centerLat), lng: String(choice.centerLng) });
      setRadius(String(choice.radiusKm));
    } else {
      setKind("polygon");
      setPoints(choice.points.map(([lat, lng]) => `${lat}, ${lng}`).join("\n"));
    }
  };

  const useMyPosition = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPreset(null);
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
    <form
      className="card form-grid"
      style={{ padding: 18 }}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => save(data));
      }}
    >
      <input type="hidden" name="assetId" value={assetId} />

      <div className="field col-span-2">
        {labels.fence_presets}
        <div className="fence-presets">
          {FENCE_PRESETS.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className={`btn-chip ${preset === choice.id ? "btn-chip--active" : ""}`}
              aria-pressed={preset === choice.id}
              onClick={() => applyPreset(choice)}
            >
              {labels[`fence_preset_${choice.id}`] ?? choice.id}
            </button>
          ))}
        </div>
        <span className="field-hint">{labels.fence_preset_hint}</span>
      </div>

      <label className="field">
        {labels.fence_name}
        <input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="field">
        {labels.fence_kind}
        <select
          name="kind"
          value={kind}
          onChange={(event) => {
            setPreset(null);
            setKind(event.target.value as "circle" | "polygon");
          }}
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
                inputMode="decimal"
                aria-label={labels.aria_lat}
                value={center.lat}
                onChange={(event) => {
                  setPreset(null);
                  setCenter((prev) => ({ ...prev, lat: event.target.value }));
                }}
              />
              <input
                name="centerLng"
                type="number"
                step="any"
                inputMode="decimal"
                aria-label={labels.aria_lng}
                value={center.lng}
                onChange={(event) => {
                  setPreset(null);
                  setCenter((prev) => ({ ...prev, lng: event.target.value }));
                }}
              />
            </div>
          </label>
          <label className="field">
            {labels.fence_radius}
            <input
              name="radiusKm"
              type="number"
              min={0.1}
              step="0.1"
              inputMode="decimal"
              value={radius}
              onChange={(event) => {
                setPreset(null);
                setRadius(event.target.value);
              }}
            />
          </label>
          <div className="col-span-2">
            <button
              type="button"
              className="btn-chip"
              onClick={useMyPosition}
              disabled={locating}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <IconPin size={16} /> {labels.fence_use_location}
            </button>
          </div>
        </>
      ) : (
        <label className="field col-span-2">
          {labels.fence_points}
          <textarea
            name="points"
            rows={5}
            value={points}
            onChange={(event) => {
              setPreset(null);
              setPoints(event.target.value);
            }}
          />
          <span className="field-hint">{labels.fence_points_hint}</span>
        </label>
      )}

      <label className="field">
        {labels.fence_approach}
        <input
          name="approachKm"
          type="number"
          min={0.1}
          step="0.1"
          defaultValue={state && "values" in state ? state.values?.approachKm : 1}
        />
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
