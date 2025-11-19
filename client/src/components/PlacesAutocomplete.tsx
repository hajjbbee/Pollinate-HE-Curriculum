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
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // Load Google Maps script
    if (typeof google !== "undefined" && google.maps) {
      setIsLoaded(true);
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
    if (!apiKey) {
      console.error("Google Maps API key not found. Set VITE_GOOGLE_MAPS_API_KEY environment variable.");
      setLoadError(true);
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`) as HTMLScriptElement;
    if (existingScript) {
      // Script exists but may still be loading - poll for Google availability
      const checkInterval = setInterval(() => {
        if (typeof google !== "undefined" && google.maps) {
          setIsLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);

      // Clear interval after 10 seconds to prevent infinite polling
      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        if (typeof google === "undefined" || !google.maps) {
          setLoadError(true);
        }
      }, 10000);

      return () => {
        clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    script.onerror = () => {
      console.error("Failed to load Google Maps script");
      setLoadError(true);
    };
    document.head.appendChild(script);
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

  if (loadError) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        data-testid={dataTestId}
        disabled
        title="Google Maps API failed to load. Please check your internet connection or API key."
      />
    );
  }

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={!isLoaded ? "Loading..." : placeholder}
      className={className}
      data-testid={dataTestId}
      autoComplete="off"
      disabled={!isLoaded}
    />
  );
}
