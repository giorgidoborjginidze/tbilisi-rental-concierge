"use client";

import { useActionState, useState } from "react";
import { saveGpsDevice, savePlate } from "@/lib/rentals/actions";
import type { FormState } from "@/lib/units/actions";

// Binding the tracker to this vehicle, and the plate that the geofence
// messages quote. The ping address and token are shown ready to copy —
// that is all most trackers need.
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
    ? `${endpoint}?deviceId=${encodeURIComponent(device.deviceId)}&token=${device.token}&lat=41.7151&lng=44.8271`
    : `${endpoint}?deviceId=…&token=…&lat=…&lng=…`;

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
            <div>
              <span className="field-hint">{labels.gps_token}</span>
              <code>{device.token}</code>
              <button
                type="button"
                className="btn-chip"
                onClick={() => copy(device.token, "token")}
              >
                {copied === "token" ? "✓" : "⧉"}
              </button>
            </div>
            <div>
              <span className="field-hint">{labels.gps_endpoint}</span>
              <code>{pingUrl}</code>
              <button
                type="button"
                className="btn-chip"
                onClick={() => copy(pingUrl, "url")}
              >
                {copied === "url" ? "✓" : "⧉"}
              </button>
            </div>
            <p className="field-hint">{labels.gps_endpoint_hint}</p>
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
