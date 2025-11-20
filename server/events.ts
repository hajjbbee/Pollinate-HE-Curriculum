import { InsertUpcomingEvent } from "@shared/schema";

const EVENTBRITE_API_KEY = process.env.EVENTBRITE_API_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

interface EventbriteEvent {
  id: string;
  name: { text: string };
  start: { local: string };
  end?: { local: string };
  venue?: {
    address: {
      localized_address_display: string;
    };
    latitude?: string;
    longitude?: string;
  };
  is_free: boolean;
  ticket_availability?: {
    minimum_ticket_price?: {
      display: string;
    };
  };
  url: string;
  description?: { text: string };
  category_id: string;
}

/**
 * Fetch events from Eventbrite API
 */
async function fetchEventbriteEvents(
  lat: number,
  lng: number,
  radiusKm: number,
  keywords: string[],
  startDate: Date,
  endDate: Date
): Promise<Partial<InsertUpcomingEvent>[]> {
  if (!EVENTBRITE_API_KEY) {
    console.log("⚠️ EVENTBRITE_API_KEY not configured, skipping Eventbrite events");
    return [];
  }

  try {
    const categoryIds = ["103", "110", "113", "105"]; // Education, Science, Art, Family
    const query = keywords.slice(0, 3).join(" OR ");
    
    const url = new URL("https://www.eventbriteapi.com/v3/events/search/");
    url.searchParams.append("location.latitude", lat.toString());
    url.searchParams.append("location.longitude", lng.toString());
    url.searchParams.append("location.within", `${radiusKm}km`);
    url.searchParams.append("start_date.range_start", startDate.toISOString());
    url.searchParams.append("start_date.range_end", endDate.toISOString());
    url.searchParams.append("expand", "venue,ticket_availability");
    url.searchParams.append("categories", categoryIds.join(","));
    if (query) {
      url.searchParams.append("q", query);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${EVENTBRITE_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error(`Eventbrite API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const events: Partial<InsertUpcomingEvent>[] = [];

    for (const event of (data.events || []) as EventbriteEvent[]) {
      const cost = event.is_free
        ? "FREE"
        : event.ticket_availability?.minimum_ticket_price?.display || "Paid";

      events.push({
        eventName: event.name.text,
        eventDate: new Date(event.start.local),
        endDate: event.end ? new Date(event.end.local) : undefined,
        location: event.venue?.address?.localized_address_display || "Online",
        latitude: event.venue?.latitude ? parseFloat(event.venue.latitude) : undefined,
        longitude: event.venue?.longitude ? parseFloat(event.venue.longitude) : undefined,
        cost,
        category: getCategoryFromId(event.category_id),
        description: event.description?.text?.substring(0, 500),
        ticketUrl: event.url,
        source: "eventbrite",
        externalId: event.id,
      });
    }

    console.log(`✅ Found ${events.length} Eventbrite events`);
    return events;
  } catch (error) {
    console.error("Error fetching Eventbrite events:", error);
    return [];
  }
}

/**
 * Search Google Places for event venues related to the theme
 */
async function fetchGooglePlacesEvents(
  lat: number,
  lng: number,
  radiusMeters: number,
  theme: string
): Promise<Partial<InsertUpcomingEvent>[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.log("⚠️ GOOGLE_MAPS_API_KEY not configured");
    return [];
  }

  try {
    const keywords = extractKeywords(theme);
    const types = ["tourist_attraction", "museum", "library", "point_of_interest"];
    const events: Partial<InsertUpcomingEvent>[] = [];

    for (const type of types.slice(0, 2)) {
      const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
      url.searchParams.append("location", `${lat},${lng}`);
      url.searchParams.append("radius", radiusMeters.toString());
      url.searchParams.append("type", type);
      url.searchParams.append("keyword", keywords.slice(0, 2).join(" "));
      url.searchParams.append("key", GOOGLE_MAPS_API_KEY);

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.status !== "OK") continue;

      for (const place of (data.results || []).slice(0, 3)) {
        // Create generic "visit" events from places
        events.push({
          eventName: `Visit: ${place.name}`,
          eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
          location: place.vicinity,
          latitude: place.geometry?.location?.lat,
          longitude: place.geometry?.location?.lng,
          cost: "Varies",
          category: type === "museum" ? "history" : "education",
          description: `Self-guided visit to ${place.name}`,
          source: "google_places",
          externalId: place.place_id,
        });
      }
    }

    console.log(`✅ Found ${events.length} Google Places events`);
    return events;
  } catch (error) {
    console.error("Error fetching Google Places events:", error);
    return [];
  }
}

/**
 * Main function to discover events for a family's weekly theme
 */
export async function discoverWeeklyEvents(
  familyId: string,
  lat: number,
  lng: number,
  radiusKm: number,
  weekTheme: string,
  weekStartDate: Date
): Promise<Partial<InsertUpcomingEvent>[]> {
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 7);

  const keywords = extractKeywords(weekTheme);
  
  // Fetch from multiple sources
  const [eventbriteEvents, googleEvents] = await Promise.all([
    fetchEventbriteEvents(lat, lng, radiusKm, keywords, weekStartDate, weekEndDate),
    fetchGooglePlacesEvents(lat, lng, radiusKm * 1000, weekTheme),
  ]);

  // Combine and deduplicate
  const allEvents = [...eventbriteEvents, ...googleEvents];
  const uniqueEvents = deduplicateEvents(allEvents);

  // Add familyId and calculate drive times
  return uniqueEvents.slice(0, 8).map(event => ({
    ...event,
    familyId,
    driveMinutes: event.latitude && event.longitude 
      ? estimateDriveTime(lat, lng, event.latitude, event.longitude)
      : undefined,
    whyItFits: generateWhyItFits(weekTheme, event.eventName || ""),
  }));
}

/**
 * Extract keywords from theme for search
 */
function extractKeywords(theme: string): string[] {
  const stopWords = ["the", "and", "of", "in", "to", "a", "an"];
  return theme
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.includes(word))
    .slice(0, 5);
}

/**
 * Deduplicate events by name and location
 */
function deduplicateEvents(events: Partial<InsertUpcomingEvent>[]): Partial<InsertUpcomingEvent>[] {
  const seen = new Set<string>();
  return events.filter(event => {
    const key = `${event.eventName?.toLowerCase()}-${event.location?.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Estimate drive time using haversine distance
 */
function estimateDriveTime(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  
  // Assume average speed of 50 km/h in urban areas
  return Math.round(distanceKm / 50 * 60);
}

/**
 * Generate "why it fits" explanation
 */
function generateWhyItFits(theme: string, eventName: string): string {
  const themeWords = extractKeywords(theme);
  const matchingWords = themeWords.filter(word => 
    eventName.toLowerCase().includes(word)
  );
  
  if (matchingWords.length > 0) {
    return `Connects to your "${theme}" theme through ${matchingWords.join(", ")}`;
  }
  
  return `Enriches your learning about ${theme}`;
}

/**
 * Map Eventbrite category ID to our category system
 */
function getCategoryFromId(categoryId: string): string {
  const categoryMap: Record<string, string> = {
    "103": "education",
    "110": "science",
    "113": "art",
    "105": "family",
    "108": "history",
    "109": "education",
  };
  return categoryMap[categoryId] || "education";
}
