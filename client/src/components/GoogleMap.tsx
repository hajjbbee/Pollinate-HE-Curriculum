import { useEffect, useRef } from "react";

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  address: string;
  category?: string;
}

interface GoogleMapProps {
  center: { lat: number; lng: number };
  markers: MapMarker[];
  zoom?: number;
  className?: string;
}

export function GoogleMap({ center, markers, zoom = 12, className = "" }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    // Load Google Maps script if not already loaded
    const loadGoogleMaps = () => {
      if (typeof google !== "undefined" && google.maps) {
        initializeMap();
        return;
      }

      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
      if (!apiKey) {
        console.error("Google Maps API key not found. Set VITE_GOOGLE_MAPS_API_KEY environment variable.");
        return;
      }

      // Check if script already exists
      if (document.querySelector(`script[src*="maps.googleapis.com"]`)) {
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => initializeMap();
      script.onerror = () => console.error("Failed to load Google Maps script");
      document.head.appendChild(script);
    };

    const initializeMap = () => {
      if (!mapRef.current) return;

      // Create map
      googleMapRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      });

      // Add markers
      updateMarkers();
    };

    loadGoogleMaps();
  }, []);

  useEffect(() => {
    updateMarkers();
  }, [markers]);

  const updateMarkers = () => {
    if (!googleMapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    // Add new markers
    markers.forEach((markerData) => {
      const marker = new google.maps.Marker({
        position: { lat: markerData.lat, lng: markerData.lng },
        map: googleMapRef.current!,
        title: markerData.name,
      });

      // Add info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <h3 style="margin: 0 0 4px 0; font-weight: 600; font-size: 14px;">${markerData.name}</h3>
            ${markerData.category ? `<div style="font-size: 12px; color: #666; margin-bottom: 4px;">${markerData.category}</div>` : ""}
            <div style="font-size: 12px; color: #888;">${markerData.address}</div>
          </div>
        `,
      });

      marker.addListener("click", () => {
        infoWindow.open(googleMapRef.current!, marker);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (markers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((marker) => {
        bounds.extend({ lat: marker.lat, lng: marker.lng });
      });
      googleMapRef.current.fitBounds(bounds);
    }
  };

  return <div ref={mapRef} className={`w-full h-full ${className}`} data-testid="map-container" />;
}
