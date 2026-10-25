import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RetailLocation } from "../planning";
export interface MapPoint {
  location: RetailLocation;
  severity: "shortage" | "available" | "balanced";
  label: string;
}
export default function RetailMap({
  points,
  route,
  onSelect,
}: {
  points: MapPoint[];
  route?: [RetailLocation, RetailLocation];
  onSelect: (name: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const [error, setError] = useState("");
  const [provider, setProvider] = useState("");
  const signature = JSON.stringify({
    points,
    route,
  });
  useEffect(() => {
    let cancelled = false;
    let remove = () => {};
    setError("");
    setProvider("Loading map…");
    const start = async () => {
      if (!container.current) return;
      if (cancelled || !container.current) return;
      const map = L.map(container.current, { scrollWheelZoom: false }).setView(
        [49.27, -123.05],
        10,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      points.forEach((p) => {
        const marker = L.marker([p.location.lat, p.location.lng], {
          icon: L.divIcon({
            className: "retail-map-pin",
            html: `<button class="geo-marker ${p.severity}" aria-label="${p.location.name}">${p.severity === "shortage" ? "!" : p.severity === "available" ? "+" : "•"}</button>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
        }).addTo(map);
        marker.bindTooltip(`${p.location.name}: ${p.label}`, {
          direction: "top",
          offset: [0, -15],
        });
        marker.on("click", () => selectRef.current(p.location.name));
      });
      if (route)
        L.polyline(
          route.map((p) => [p.lat, p.lng] as L.LatLngTuple),
          { color: "#0070f2", weight: 4, dashArray: "8 7" },
        ).addTo(map);
      if (points.length > 1)
        map.fitBounds(
          L.latLngBounds(
            points.map(
              (p) => [p.location.lat, p.location.lng] as L.LatLngTuple,
            ),
          ),
          { padding: [40, 40], maxZoom: 12 },
        );
      else if (points[0])
        map.setView([points[0].location.lat, points[0].location.lng], 11);
      setProvider("OpenStreetMap");
      const timer = setTimeout(() => map.invalidateSize(), 100);
      remove = () => {
        clearTimeout(timer);
        map.remove();
      };
    };
    void start().catch((e) => {
      if (!cancelled) setError(String(e));
    });
    return () => {
      cancelled = true;
      remove();
    };
    // The signature tracks map content; callback identity must not reset the viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return (
    <div className="map-wrapper">
      <div className="map-provider">
        <span>{provider}</span>
        <span>Demo locations · not live shipment tracking</span>
      </div>
      <div
        ref={container}
        className="retail-map"
        aria-label="Retail inventory locations and suggested stock transfer route"
      />
      {error && (
        <div role="alert" className="map-error">
          {error}
        </div>
      )}
      <div className="map-legend">
        <span>
          <i className="pin-shortage" />
          Supply shortage
        </span>
        <span>
          <i className="pin-available" />
          Available stock
        </span>
        <span>
          <i className="pin-balanced" />
          Protected / balanced
        </span>
        <span>Dashed lines = proposed links, not driving routes</span>
      </div>
    </div>
  );
}
