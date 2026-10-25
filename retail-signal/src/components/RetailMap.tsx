import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RetailLocation } from "../planning";
import type { Connections } from "../connections";
export interface MapPoint {
  location: RetailLocation;
  severity: "shortage" | "available" | "balanced";
  label: string;
}
let googleLoad: Promise<void> | null = null;
function loadGoogle(key: string): Promise<void> {
  if (typeof window.google?.maps?.importLibrary === "function")
    return Promise.resolve();
  if (googleLoad) return googleLoad;
  googleLoad = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      googleLoad = null;
      reject(
        new Error(
          "Google Maps did not respond. Check the key, domain restrictions and billing.",
        ),
      );
    }, 20000);
    Object.assign(window, {
      retailSignalGoogleReady: () => {
        clearTimeout(timer);
        resolve();
      },
      gm_authFailure: () => {
        clearTimeout(timer);
        googleLoad = null;
        window.dispatchEvent(new Event("retailSignalGoogleAuthError"));
        reject(
          new Error(
            "Google Maps rejected the API key. Check API and referrer restrictions.",
          ),
        );
      },
    });
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=retailSignalGoogleReady&v=quarterly&auth_referrer_policy=origin`;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      googleLoad = null;
      script.remove();
      reject(
        new Error(
          "Google Maps could not load. OpenStreetMap remains available.",
        ),
      );
    };
    document.head.append(script);
  });
  return googleLoad;
}
export default function RetailMap({
  points,
  route,
  connections,
  onSelect,
}: {
  points: MapPoint[];
  route?: [RetailLocation, RetailLocation];
  connections: Connections;
  onSelect: (name: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const [error, setError] = useState("");
  const [provider, setProvider] = useState("");
  const [fallback, setFallback] = useState(false);
  const signature = JSON.stringify({
    points,
    route,
    key: connections.googleMapsKey,
    mapId: connections.googleMapId,
    fallback,
  });
  useEffect(() => {
    let cancelled = false;
    let remove = () => {};
    if (!fallback) setError("");
    setProvider("Loading map…");
    const authFailure = () => {
      if (!cancelled) {
        setError(
          "Google Maps rejected the API key. Check API enablement, billing and website restrictions.",
        );
        setFallback(true);
      }
    };
    window.addEventListener("retailSignalGoogleAuthError", authFailure);
    const start = async () => {
      if (!container.current) return;
      if (connections.googleMapsKey && !fallback) {
        try {
          await loadGoogle(connections.googleMapsKey);
          const [{ Map, Polyline }, { AdvancedMarkerElement }] =
            await Promise.all([
              google.maps.importLibrary(
                "maps",
              ) as Promise<google.maps.MapsLibrary>,
              google.maps.importLibrary(
                "marker",
              ) as Promise<google.maps.MarkerLibrary>,
            ]);
          if (cancelled || !container.current) return;
          const map = new Map(container.current, {
            center: { lat: 49.27, lng: -123.05 },
            zoom: 10,
            mapId: connections.googleMapId || "DEMO_MAP_ID",
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
          const bounds = new google.maps.LatLngBounds();
          const markers: google.maps.marker.AdvancedMarkerElement[] = [];
          for (const p of points) {
            const content = document.createElement("button");
            content.className = `geo-marker ${p.severity}`;
            content.textContent =
              p.severity === "shortage"
                ? "!"
                : p.severity === "available"
                  ? "+"
                  : "•";
            content.title = `${p.location.name}: ${p.label}`;
            content.onclick = () => selectRef.current(p.location.name);
            const marker = new AdvancedMarkerElement({
              map,
              position: { lat: p.location.lat, lng: p.location.lng },
              content,
              title: content.title,
            });
            markers.push(marker);
            bounds.extend(marker.position!);
          }
          let line: google.maps.Polyline | undefined;
          if (route)
            line = new Polyline({
              map,
              path: route.map((p) => ({ lat: p.lat, lng: p.lng })),
              strokeColor: "#0070f2",
              strokeWeight: 4,
              icons: [
                {
                  icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW },
                  offset: "100%",
                },
              ],
            });
          if (points.length > 1) map.fitBounds(bounds, 55);
          else if (points[0]) {
            map.setCenter({
              lat: points[0].location.lat,
              lng: points[0].location.lng,
            });
            map.setZoom(11);
          }
          setProvider("Google Maps");
          remove = () => {
            markers.forEach((m) => (m.map = null));
            line?.setMap(null);
            google.maps.event.clearInstanceListeners(map);
          };
          return;
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Google Maps failed.");
            setFallback(true);
          }
          return;
        }
      }
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
      window.removeEventListener("retailSignalGoogleAuthError", authFailure);
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
