import { InsertUpcomingEvent, HomeschoolGroup } from "@shared/schema";
import { fetchAllFacebookGroupEvents } from "./facebook-scraper";

const EVENTBRITE_API_KEY = process.env.EVENTBRITE_API_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Homeschool-specific keywords for enhanced discovery
const HOMESCHOOL_KEYWORDS = [
  "homeschool",
  "co-op",
  "charlotte mason",
  "montessori",
  "waldorf",
  "forest school",
  "nature study",
  "classical education",
  "unschooling",
  "project-based learning",
  "hands-on learning",
  "educational",
  "science fair",
  "field trip",
  "maker space",
];

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
 * Search Google Places for homeschool-friendly venues and locations
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
    const homeschoolKeyword = "homeschool education family";
    
    // Enhanced search with homeschool-specific places
    const types = [
      "museum", 
      "library", 
      "park",
      "aquarium",
      "zoo",
      "tourist_attraction",
    ];
    const events: Partial<InsertUpcomingEvent>[] = [];

    // Search for homeschool-friendly locations
    for (const type of types.slice(0, 3)) {
      const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
      url.searchParams.append("location", `${lat},${lng}`);
      url.searchParams.append("radius", radiusMeters.toString());
      url.searchParams.append("type", type);
      
      // Combine theme keywords with homeschool keywords
      const searchQuery = [...keywords.slice(0, 1), homeschoolKeyword].join(" ");
      url.searchParams.append("keyword", searchQuery);
      url.searchParams.append("key", GOOGLE_MAPS_API_KEY);

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.log(`Google Places API status: ${data.status}`);
        continue;
      }

      for (const place of (data.results || []).slice(0, 2)) {
        // Create generic "visit" events from places
        events.push({
          eventName: `Visit: ${place.name}`,
          eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
          location: place.vicinity,
          latitude: place.geometry?.location?.lat,
          longitude: place.geometry?.location?.lng,
          cost: place.business_status === "OPERATIONAL" ? "Varies" : "Check website",
          category: mapPlaceTypeToCategory(type),
          description: `Educational visit to ${place.name}. ${place.types?.includes('museum') ? 'Many museums offer homeschool programs.' : ''}`,
          source: "google_places",
          externalId: place.place_id,
        });
      }
    }

    console.log(`✅ Found ${events.length} Google Places locations`);
    return events;
  } catch (error) {
    console.error("Error fetching Google Places events:", error);
    return [];
  }
}

/**
 * Map Google Places type to our category system
 */
function mapPlaceTypeToCategory(placeType: string): string {
  const categoryMap: Record<string, string> = {
    museum: "history",
    library: "education",
    park: "nature",
    aquarium: "science",
    zoo: "science",
    tourist_attraction: "education",
  };
  return categoryMap[placeType] || "education";
}

/**
 * Main function to discover events for a family's weekly theme
 * Includes automatic discovery + optional Facebook group events
 */
export async function discoverWeeklyEvents(
  familyId: string,
  lat: number,
  lng: number,
  radiusKm: number,
  weekTheme: string,
  weekStartDate: Date,
  facebookGroups?: HomeschoolGroup[]
): Promise<Partial<InsertUpcomingEvent>[]> {
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 7);

  const keywords = extractKeywords(weekTheme);
  
  console.log(`🔍 Discovering events for theme: "${weekTheme}"`);
  
  // Fetch from all sources in parallel
  const [eventbriteEvents, googleEvents, facebookEvents] = await Promise.all([
    fetchEventbriteEvents(lat, lng, radiusKm, keywords, weekStartDate, weekEndDate),
    fetchGooglePlacesEvents(lat, lng, radiusKm * 1000, weekTheme),
    facebookGroups && facebookGroups.length > 0
      ? fetchAllFacebookGroupEvents(
          facebookGroups.map(g => ({ groupId: g.groupId, groupName: g.groupName }))
        )
      : Promise.resolve([]),
  ]);

  // Combine and deduplicate
  const allEvents = [...eventbriteEvents, ...googleEvents, ...facebookEvents];
  const uniqueEvents = deduplicateEvents(allEvents);

  console.log(`✅ Total discovered: ${uniqueEvents.length} events (${eventbriteEvents.length} Eventbrite, ${googleEvents.length} Google, ${facebookEvents.length} Facebook)`);

  // Add familyId and calculate drive times
  return uniqueEvents.slice(0, 12).map(event => ({
    ...event,
    familyId,
    driveMinutes: event.latitude && event.longitude 
      ? estimateDriveTime(lat, lng, event.latitude, event.longitude)
      : undefined,
    whyItFits: event.whyItFits || generateWhyItFits(weekTheme, event.eventName || ""),
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
