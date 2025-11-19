import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: google.maps.places.PlaceResult) => void;
  placeholder?: string;
  country?: string;
  className?: string;
  dataTestId?: string;
}

export function PlacesAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder,
  country,
  className,
  dataTestId,
}: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load Google Maps script
    const loadGoogleMaps = () => {
      if (typeof google !== "undefined" && google.maps) {
        setIsLoaded(true);
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
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => setIsLoaded(true);
      script.onerror = () => console.error("Failed to load Google Maps script");
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    // Initialize autocomplete
    const options: google.maps.places.AutocompleteOptions = {
      types: ["address"],
    };

    if (country) {
      options.componentRestrictions = { country: country.toLowerCase() };
    }

    autocompleteRef.current = new google.maps.places.Autocomplete(
      inputRef.current,
      options
    );

    // Listen for place selection
    const listener = autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace();
      if (place && place.formatted_address) {
        onChange(place.formatted_address);
        onPlaceSelected?.(place);
      }
    });

    return () => {
      if (listener) {
        google.maps.event.removeListener(listener);
      }
    };
  }, [isLoaded, country, onChange, onPlaceSelected]);

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      data-testid={dataTestId}
      autoComplete="off"
    />
  );
}
