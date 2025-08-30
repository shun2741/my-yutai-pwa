"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { getCatalog } from "../../lib/db";
import { Catalog } from "../../lib/types";
import Card, { CardBody } from "../../components/ui/Card";

declare const L: any; // Leaflet (CDN)

const TOKYO = { lng: 139.767125, lat: 35.681236, zoom: 12 };

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [catalog, setCatalog] = useState<Catalog | undefined>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => setCatalog(await getCatalog()))();
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const init = async () => {
      let center = TOKYO;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 3000 }));
        center = { lng: pos.coords.longitude, lat: pos.coords.latitude, zoom: 13 };
      } catch (_) {
        // fallback to TOKYO
      }
      const map = L.map(mapRef.current).setView([center.lat, center.lng], center.zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      if (catalog?.stores?.length) {
        for (const s of catalog.stores) {
          const marker = L.marker([s.lat, s.lng]);
          marker.bindPopup(s.name);
          marker.addTo(map);
        }
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, catalog]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">マップ</h1>
      <Card>
        <CardBody>
          <div ref={mapRef} className="h-[70vh] w-full rounded-lg border border-gray-200 dark:border-gray-800" />
        </CardBody>
      </Card>
      {/* Leaflet CDN */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
      <Script
        src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossOrigin=""
        onLoad={() => setReady(true)}
        strategy="afterInteractive"
      />
    </div>
  );
}
