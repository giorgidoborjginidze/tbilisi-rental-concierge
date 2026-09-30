"use client";

import { useActionState, useState } from "react";
import { saveGpsDevice, savePlate } from "@/lib/rentals/actions";
import type { FormState } from "@/lib/units/actions";
import { EXAMPLE_POSITION } from "@/lib/geo/presets";
import { IconCheck, IconCopy } from "@/app/icons";

// Binding the tracker to this vehicle, and the plate that the geofence
// messages quote. A tracker cannot start reporting here by itself: the
// installer or the tracking provider sets it (or their tracking server) up
// with the address shown, so the page says exactly that. The address that
// is copied carries the device and its token only — never a position; the
// example with coordinates sits apart, under the technical details, and
// is marked as an example (the endpoint refuses its position anyway).
export default function GpsForm({
  assetId,
  plate,
  device,
  endpoint,
  labels,
}: {
  assetId: string;
  plate: string;
  device: {
    deviceId: string;
    label: string;
    provider: string;
    token: string;
  } | null;
  endpoint: string;
  labels: Record<string, string>;
}) {
  const [deviceState, save, saving] = useActionState<FormState, FormData>(
    saveGpsDevice,
    null,
  );
  const [plateState, storePlate, savingPlate] = useActionState<FormState, FormData>(
    savePlate,
    null,
  );
  const [copied, setCopied] = useState<string | null>(null);

  const pingUrl = device
    ? `${endpoint}?deviceId=${encodeURIComponent(device.deviceId)}&token=${encodeURIComponent(device.token)}`
    : `${endpoint}?deviceId=…&token=…`;
  const exampleUrl = `${pingUrl}&lat=${EXAMPLE_POSITION.lat}&lng=${EXAMPLE_POSITION.lng}&speed=54`;

  const copy = (value: string, key: string) => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(key);
        setTimeout(() => setCopied(null), 1600);
      },
      () => undefined,
    );
  };

  return (
    <div className="rental-two">
      <form action={storePlate} className="card form-grid" style={{ padding: 18 }}>
        <label className="field col-span-2">
          {labels.asset_plate}
          <input
            name="plateNumber"
            defaultValue={plate}
            placeholder="AA-123-BB"
            style={{ textTransform: "uppercase" }}
          />
        </label>
        <input type="hidden" name="assetId" value={assetId} />
        <p className="field-hint col-span-2">{labels.asset_plate_hint}</p>
        {plateState?.error && (
          <p className="form-error col-span-2">{labels[plateState.error]}</p>
        )}
        <div className="col-span-2">
          <button type="submit" className="btn-primary" disabled={savingPlate}>
            {labels.save}
          </button>
        </div>
      </form>

      <form action={save} className="card form-grid" style={{ padding: 18 }}>
        <input type="hidden" name="assetId" value={assetId} />
        <label className="field">
          {labels.gps_device_id}
          <input name="deviceId" defaultValue={device?.deviceId ?? ""} required />
        </label>
        <label className="field">
          {labels.gps_label}
          <input name="label" defaultValue={device?.label ?? ""} />
        </label>
        <label className="field col-span-2">
          {labels.gps_provider}
          <input
            name="provider"
            defaultValue={device?.provider ?? ""}
            placeholder="Teltonika / Concox / …"
          />
        </label>

        {device && (
          <div className="col-span-2 gps-copy">
            <p className="field-hint" style={{ margin: 0 }}>{labels.gps_endpoint_hint}</p>
            <div>
              <span className="field-hint">{labels.gps_endpoint}</span>
              <code>{pingUrl}</code>
              <button
                type="button"
                className="btn-chip"
                aria-label={labels.gps_endpoint}
                onClick={() => copy(pingUrl, "url")}
              >
                {copied === "url" ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </button>
            </div>
            <details className="gps-tech">
              <summary>{labels.gps_tech_details}</summary>
              <div>
                <span className="field-hint">{labels.gps_token}</span>
                <code>{device.token}</code>
                <button
                  type="button"
                  className="btn-chip"
                  aria-label={labels.gps_token}
                  onClick={() => copy(device.token, "token")}
                >
                  {copied === "token" ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </button>
              </div>
              {/* An example of one position, never offered for copying. */}
              <div className="gps-tech__example">
                <span className="field-hint">{labels.gps_example}</span>
                <code>{exampleUrl}</code>
              </div>
              <p className="field-hint">{labels.gps_tech_note}</p>
            </details>
          </div>
        )}

        {deviceState?.error && (
          <p className="form-error col-span-2">{labels[deviceState.error]}</p>
        )}
        <div className="col-span-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {device ? labels.save : labels.gps_connect}
          </button>
        </div>
      </form>
    </div>
  );
}
