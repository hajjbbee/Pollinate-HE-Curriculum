import { Router, type Request, type Response, type Express } from "express";
import { storage } from "./storage";
import { insertFamilySchema, insertChildSchema, insertJournalEntrySchema, type CurriculumData, type WeekCurriculum } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { createServer } from "http";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { CollaborationService } from "./websocket";

const router = Router();

// Validate required API keys at startup
if (!process.env.OPENROUTER_API_KEY) {
  console.error("FATAL: OPENROUTER_API_KEY is not set. Curriculum generation will fail.");
}
if (!process.env.GOOGLE_MAPS_API_KEY) {
  console.error("FATAL: GOOGLE_MAPS_API_KEY is not set. Geocoding and opportunities search will fail.");
}

// Initialize OpenRouter client (OpenAI-compatible API)
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.REPLIT_DOMAINS || "https://replit.app",
    "X-Title": "Pollinate - Home Education Curriculum",
  },
});

// Google Maps API key
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Helper function to fetch with timeout
async function fetchWithTimeout(url: string, timeoutMs: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// Helper function to geocode address with timeout and retry
async function geocodeAddress(address: string, retries: number = 2): Promise<{ lat: number; lon: number; city?: string; state?: string; postalCode?: string }> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key is not configured");
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, 10000);
      
      if (!response.ok) {
        throw new Error(`Geocoding API returned ${response.status}`);
      }
      
      const data = await response.json();

      if (data.status !== "OK" || !data.results || data.results.length === 0) {
        if (data.status === "ZERO_RESULTS") {
          throw new Error("Address not found");
        }
        throw new Error(`Geocoding failed: ${data.status}`);
      }

      const result = data.results[0];
      const location = result.geometry.location;

      // Extract city, state, postal code
      let city, state, postalCode;
      for (const component of result.address_components) {
        if (component.types.includes("locality")) {
          city = component.long_name;
        }
        if (component.types.includes("administrative_area_level_1")) {
          state = component.short_name;
        }
        if (component.types.includes("postal_code")) {
          postalCode = component.long_name;
        }
      }

      return {
        lat: location.lat,
        lon: location.lng,
        city,
        state,
        postalCode,
      };
    } catch (error: any) {
      if (attempt === retries) {
        console.error(`Geocoding failed after ${retries + 1} attempts:`, error);
        throw error;
      }
      console.warn(`Geocoding attempt ${attempt + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  throw new Error("Geocoding failed after all retries");
}

// Helper function to search for local opportunities
async function searchLocalOpportunities(
  lat: number,
  lon: number,
  radiusMeters: number,
  country: string
): Promise<any[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error("GOOGLE_MAPS_API_KEY is not configured");
    return [];
  }

  // Educational venue types for field trips
  const keywords = [
    "museum",
    "library",
    "science center",
    "historical site",
    "nature center",
    "art gallery",
    "maker space",
    "farm",
    "botanical garden",
    "aquarium",
    "zoo",
    "planetarium",
    "children's museum",
    "science museum",
    "natural history museum",
    "art museum",
    "observatory",
    "nature preserve",
    "wildlife sanctuary",
    "community garden",
  ];

  const opportunities: any[] = [];
  const seenPlaceIds = new Set<string>();

  // Search for all keywords to get diverse results
  for (const keyword of keywords) {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${radiusMeters}&keyword=${encodeURIComponent(keyword)}&key=${GOOGLE_MAPS_API_KEY}`;
    
    try {
      const response = await fetchWithTimeout(url, 8000);
      
      if (!response.ok) {
        console.warn(`Places API HTTP ${response.status} for keyword "${keyword}"`);
        continue;
      }
      
      const data = await response.json();

      if (data.status === "OK" && data.results) {
        // Add unique results (avoid duplicates)
        for (const place of data.results.slice(0, 4)) {
          if (!seenPlaceIds.has(place.place_id)) {
            seenPlaceIds.add(place.place_id);
            opportunities.push(place);
          }
        }
      } else if (data.status === "ZERO_RESULTS") {
        // This is normal, not all keywords will have results
        continue;
      } else if (data.status === "OVER_QUERY_LIMIT") {
        console.error("Places API quota exceeded");
        break;
      } else {
        console.warn(`Places API returned status ${data.status} for keyword "${keyword}"`);
      }
    } catch (error: any) {
      if (error.message?.includes('timeout')) {
        console.warn(`Places API timeout for keyword "${keyword}", skipping...`);
      } else {
        console.error(`Failed to search for ${keyword}:`, error);
      }
    }

    // Add small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`Found ${opportunities.length} unique local opportunities within ${radiusMeters}m`);
  
  // Return up to 25 diverse opportunities
  return opportunities.slice(0, 25);
}

// Helper function to calculate distance and drive time
function calculateDriveTime(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  // Assume average speed of 50 km/h for city driving
  const minutes = Math.round((distance / 50) * 60);
  return minutes;
}

// Helper function to generate curriculum with Claude
async function generateCurriculum(
  family: any,
  children: any[],
  localOpps: any[]
): Promise<CurriculumData> {
  const today = new Date();
  const seasonMap: Record<string, string> = {
    US: today.getMonth() >= 2 && today.getMonth() <= 4 ? "Spring" : today.getMonth() >= 5 && today.getMonth() <= 7 ? "Summer" : today.getMonth() >= 8 && today.getMonth() <= 10 ? "Fall" : "Winter",
    AU: today.getMonth() >= 8 && today.getMonth() <= 10 ? "Spring" : today.getMonth() >= 11 || today.getMonth() <= 1 ? "Summer" : today.getMonth() >= 2 && today.getMonth() <= 4 ? "Fall" : "Winter",
    NZ: today.getMonth() >= 8 && today.getMonth() <= 10 ? "Spring" : today.getMonth() >= 11 || today.getMonth() <= 1 ? "Summer" : today.getMonth() >= 2 && today.getMonth() <= 4 ? "Fall" : "Winter",
  };

  const season = seasonMap[family.country] || "Spring";

  const childrenInfo = children.map(child => {
    const birthDate = new Date(child.birthdate);
    const age = Math.floor((today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return {
      name: child.name,
      age,
      interests: child.interests || [],
      learningStyle: child.learningStyle || "Mixed",
    };
  });

  const opportunitiesInfo = localOpps.slice(0, 20).map(opp => ({
    name: opp.name,
    address: opp.address,
    category: opp.category || "Educational",
  }));

  const systemPrompt = `You are an expert homeschool curriculum designer specializing in a Charlotte Mason + Montessori + unschooling hybrid approach. You create living, interest-led curricula that prioritize:

1. DEPTH OVER BREADTH - When a child shows high interest, dive deep
2. MASTERY LEVELS - Track progression: Exposure → Developing → Strong → Mastery → Mentor
3. NATURE & REAL EXPERIENCES - Prioritize outdoor learning and hands-on activities
4. FAMILY THEMES - Unite siblings with shared themes while honoring individual paths
5. LOCAL OPPORTUNITIES - Integrate real-world educational experiences

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations.`;

  const userPrompt = `Generate a personalized 12-week rolling curriculum for the ${family.familyName}.

FAMILY CONTEXT:
- Location: ${family.city}, ${family.state}, ${family.country}
- Season: ${season}
- Travel Radius: ${family.travelRadiusMinutes} minutes
- Flex for High Interest: ${family.flexForHighInterest ? "Yes" : "No"}

CHILDREN:
${childrenInfo.map(child => `- ${child.name} (age ${child.age}): Interests: ${child.interests.join(", ")}; Learning style: ${child.learningStyle}`).join("\n")}

LOCAL OPPORTUNITIES (sample):
${opportunitiesInfo.slice(0, 10).map(opp => `- ${opp.name} at ${opp.address}`).join("\n")}

REQUIREMENTS:
1. Create exactly 12 weeks of curriculum
2. Each week has a family theme that links all children
3. For each child, provide:
   - 2-3 "deep dives" (high-interest topics to explore deeply)
   - Daily plan (Monday-Friday with specific activities, Weekend summary)
   - Mastery updates (3-5 subjects with current level: Exposure, Developing, Strong, Mastery, or Mentor)
4. Include 3-8 local opportunities per week with:
   - Name and address
   - Drive time in minutes
   - Cost (Free, $, $$, $$$)
   - Why this fits the curriculum
   - Suggested dates/times
   - Website link (if available)
5. Include 10-20 resources per week across THREE categories:
   - FREE (6-8): YouTube channels/videos, Khan Academy, BBC Bitesize, Librivox audiobooks, free printables, library books with WorldCat links
   - LOW-COST under $15 (3-5): Thriftbooks, BookOutlet, Etsy printables, TeachersPayTeachers
   - RECYCLED/HOUSEHOLD/NATURE (4-7): DIY projects using cardboard, bottles, leaves, kitchen items, household objects
   PRIORITIZE recycled/household resources - these are a huge selling point for budget-conscious families!

Return JSON in this EXACT structure (no markdown, no code blocks):
{
  "generatedAt": "2025-11-19T08:00:00Z",
  "weeks": [
    {
      "weekNumber": 1,
      "familyTheme": "Discovering Our Local Ecosystem",
      "familyActivities": ["Nature walk", "Bird watching", "Stream study"],
      "localOpportunities": [
        {
          "name": "City Nature Center",
          "address": "123 Main St",
          "driveMinutes": 15,
          "cost": "Free",
          "why": "Hands-on nature exploration aligned with ecosystem theme",
          "link": "https://example.com",
          "dates": "Tuesday 10am-12pm or Saturday 2pm-4pm"
        }
      ],
      "children": [
        {
          "childId": "${children[0]?.id}",
          "name": "${children[0]?.name}",
          "age": ${childrenInfo[0]?.age},
          "deepDives": ["Bird identification", "Stream ecosystems"],
          "dailyPlan": {
            "Monday": ["Morning nature walk", "Sketch birds observed", "Read nature journal entries"],
            "Tuesday": ["Visit nature center", "Collect specimens", "Start nature journal"],
            "Wednesday": ["Stream study", "Water testing", "Draw stream life"],
            "Thursday": ["Bird watching", "Use field guides", "Track species"],
            "Friday": ["Create ecosystem diagram", "Share findings", "Plan next week"],
            "Weekend": "Family hike with nature journaling and bird watching"
          },
          "masteryUpdates": {
            "Nature Observation": "Developing",
            "Scientific Drawing": "Exposure",
            "Ecosystem Understanding": "Strong"
          }
        }
      ],
      "resources": [
        {
          "title": "Khan Academy: Ecosystems and Energy Flow",
          "link": "https://www.khanacademy.org/science/biology/ecology",
          "description": "Free video lessons on food chains, energy pyramids, and ecosystem dynamics",
          "category": "free"
        },
        {
          "title": "Build a Bird Feeder from Cardboard & String",
          "description": "Use an empty milk carton, scissors, string, and birdseed to create a hanging feeder. Observe which birds visit!",
          "category": "recycled"
        },
        {
          "title": "Leaf Pressing & Identification Kit",
          "description": "Collect fallen leaves, press between heavy books for 2 weeks, then identify species and create a nature journal",
          "category": "recycled"
        },
        {
          "title": "National Geographic Kids: Birds",
          "link": "https://kids.nationalgeographic.com/animals/birds",
          "description": "Free bird facts, photos, and videos perfect for young learners",
          "category": "free"
        },
        {
          "title": "The Birdsong Project (Librivox)",
          "link": "https://librivox.org",
          "description": "Free audiobook of bird poems and nature writing",
          "category": "free"
        },
        {
          "title": "Field Guide to Birds (Thriftbooks)",
          "link": "https://www.thriftbooks.com",
          "description": "Used Peterson or Sibley field guides, typically $8-12 in good condition",
          "category": "low-cost"
        },
        {
          "title": "DIY Stream Study Kit with Kitchen Items",
          "description": "Use mason jars to collect water samples, coffee filters for sediment testing, and pH strips from the pharmacy",
          "category": "recycled"
        },
        {
          "title": "Ecosystem Printables Bundle (Teachers Pay Teachers)",
          "link": "https://www.teacherspayteachers.com",
          "description": "Food web diagrams, labeling activities, and ecosystem sorting - free to $3",
          "category": "low-cost"
        }
      ]
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: "anthropic/claude-3.5-sonnet",
    max_tokens: 1800,
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const responseText = completion.choices[0]?.message?.content || "";
  
  // Remove markdown code blocks if present
  let cleanedResponse = responseText.trim();
  if (cleanedResponse.startsWith("```json")) {
    cleanedResponse = cleanedResponse.slice(7);
  }
  if (cleanedResponse.startsWith("```")) {
    cleanedResponse = cleanedResponse.slice(3);
  }
  if (cleanedResponse.endsWith("```")) {
    cleanedResponse = cleanedResponse.slice(0, -3);
  }
  cleanedResponse = cleanedResponse.trim();

  const curriculumData = JSON.parse(cleanedResponse);
  return curriculumData;
}

// Auth route to get current user
router.get("/api/auth/user", isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    res.json(user);
  } catch (error: any) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

// Onboarding endpoint
router.post("/api/onboarding", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { familyName, country, address, travelRadiusMinutes, flexForHighInterest, children: childrenData } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if family already exists
    const existingFamily = await storage.getFamily(req.user.id);
    if (existingFamily) {
      return res.status(400).json({ error: "Family already exists" });
    }

    // Geocode address
    const geoData = await geocodeAddress(address);

    // Create family
    const family = await storage.createFamily({
      userId: req.user.id,
      familyName,
      country,
      address,
      city: geoData.city,
      state: geoData.state,
      postalCode: geoData.postalCode,
      latitude: geoData.lat,
      longitude: geoData.lon,
      travelRadiusMinutes,
      flexForHighInterest,
    });

    // Create children
    const createdChildren = [];
    for (const childData of childrenData) {
      const child = await storage.createChild({
        familyId: family.id,
        name: childData.name,
        birthdate: childData.birthdate,
        interests: childData.interests || [],
        learningStyle: childData.learningStyle,
      });
      createdChildren.push(child);
    }

    // Search for local opportunities
    // Convert travel time (minutes) to distance (meters)
    // Assume average speed of 50 km/h for city driving
    const estimatedDistanceKm = (travelRadiusMinutes / 60) * 50;
    const radiusMeters = Math.min(estimatedDistanceKm * 1000, 50000); // Cap at 50km
    console.log(`Searching for opportunities within ${travelRadiusMinutes} min / ${Math.round(radiusMeters/1000)} km radius`);
    const opportunities = await searchLocalOpportunities(geoData.lat, geoData.lon, radiusMeters, country);

    // Save opportunities to database
    for (const opp of opportunities) {
      try {
        const driveTime = calculateDriveTime(geoData.lat, geoData.lon, opp.geometry.location.lat, opp.geometry.location.lng);
        
        await storage.createOpportunity({
          familyId: family.id,
          name: opp.name,
          address: opp.vicinity,
          latitude: opp.geometry.location.lat,
          longitude: opp.geometry.location.lng,
          driveMinutes: driveTime,
          cost: opp.price_level ? "$".repeat(opp.price_level) : "Free",
          category: opp.types?.[0] || "Educational",
          placeId: opp.place_id,
        });
      } catch (error) {
        console.error("Failed to save opportunity:", error);
      }
    }

    // Generate initial curriculum
    try {
      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error("OpenRouter API key is not configured. Please set OPENROUTER_API_KEY environment variable.");
      }
      
      const curriculumData = await generateCurriculum(family, createdChildren, opportunities);

      await storage.createCurriculum({
        familyId: family.id,
        generatedAt: new Date(),
        curriculumData,
        isActive: true,
      });
    } catch (aiError: any) {
      console.error("Curriculum generation error:", aiError);
      
      // Check for specific error types
      if (aiError.message?.includes("credit balance") || aiError.message?.includes("billing") || aiError.status === 402) {
        return res.status(402).json({ 
          error: "AI service has insufficient credits. Please add credits to your OpenRouter account at openrouter.ai or contact support." 
        });
      }
      
      if (aiError.message?.includes("API key") || aiError.status === 401) {
        return res.status(500).json({
          error: "AI service configuration error. Please contact support."
        });
      }
      
      // For other AI errors, still allow onboarding to complete
      console.warn("Curriculum generation failed, but onboarding will complete. User can regenerate later.");
    }

    res.json({ family, children: createdChildren });
  } catch (error: any) {
    console.error("Onboarding error:", error);
    res.status(500).json({ error: error.message || "Failed to complete onboarding" });
  }
});

// Get family
router.get("/api/family", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    res.json(family);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get children
router.get("/api/children", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const children = await storage.getChildren(family.id);
    res.json(children);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get active curriculum
router.get("/api/curriculum", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const curriculum = await storage.getActiveCurriculum(family.id);
    if (!curriculum) {
      return res.status(404).json({ error: "No active curriculum found" });
    }

    res.json(curriculum);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Regenerate specific week
router.post("/api/curriculum/regenerate", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { weekNumber } = req.body;

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const children = await storage.getChildren(family.id);
    const opportunities = await storage.getOpportunities(family.id);

    // Generate new curriculum
    const curriculumData = await generateCurriculum(family, children, opportunities);

    // Deactivate old curricula
    await storage.deactivateAllCurricula(family.id);

    // Save new curriculum
    const newCurriculum = await storage.createCurriculum({
      familyId: family.id,
      generatedAt: new Date(),
      curriculumData,
      isActive: true,
    });

    // Broadcast curriculum update to other connected users
    const collabService = getCollaborationService();
    if (collabService) {
      collabService.broadcastCurriculumGenerated(family.id);
    }

    res.json(newCurriculum);
  } catch (error: any) {
    console.error("Regenerate error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Journal endpoints
router.post("/api/journal", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const { childId, entryDate, content, photoUrls } = req.body;

    const entry = await storage.createJournalEntry({
      childId,
      familyId: family.id,
      entryDate,
      content,
      photoUrls: photoUrls || [],
    });

    res.json(entry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/journal", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const entries = await storage.getJournalEntries(family.id);
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Local opportunities
router.get("/api/opportunities", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const opportunities = await storage.getOpportunities(family.id);
    res.json(opportunities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upcoming events
router.get("/api/events/week/:weekNumber", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const weekNumber = parseInt(req.params.weekNumber);
    if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 12) {
      return res.status(400).json({ error: "Invalid week number" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    // Calculate week date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + (weekNumber - 1) * 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    // Get cached events or fetch new ones
    let events = await storage.getUpcomingEvents(family.id, startDate, endDate);
    
    if (events.length === 0) {
      // No cached events, fetch from APIs
      console.log(`🎪 No cached events for week ${weekNumber}, discovering new events...`);
      const { discoverWeeklyEvents } = await import("./events");
      const curriculum = await storage.getActiveCurriculum(family.id);
      
      if (curriculum) {
        const curriculumData = curriculum.curriculumData as any;
        const weekTheme = curriculumData.weeks[weekNumber - 1]?.familyTheme || "education";
        console.log(`🎯 Week ${weekNumber} theme: "${weekTheme}"`);
        
        const radiusKm = (family.travelRadiusMinutes / 60) * 50; // Assume 50 km/h average speed
        const newEvents = await discoverWeeklyEvents(
          family.id,
          family.latitude,
          family.longitude,
          radiusKm,
          weekTheme,
          startDate
        );

        console.log(`📅 Discovered ${newEvents.length} events for week ${weekNumber}`);

        // Save to database
        for (const event of newEvents) {
          try {
            await storage.createEvent(event as any);
          } catch (err) {
            console.error("Error saving event:", err);
          }
        }

        events = await storage.getUpcomingEvents(family.id, startDate, endDate);
        console.log(`✅ Cached ${events.length} events for week ${weekNumber}`);
      } else {
        console.log(`⚠️ No curriculum found for family ${family.id}`);
      }
    } else {
      console.log(`✨ Returning ${events.length} cached events for week ${weekNumber}`);
    }

    res.json(events);
  } catch (error: any) {
    console.error("Error fetching events:", error);
    res.status(500).json({ error: error.message });
  }
});

// Object storage routes
router.post("/api/objects/upload", isAuthenticated, async (req: Request, res: Response) => {
  const objectStorageService = new ObjectStorageService();
  const uploadURL = await objectStorageService.getObjectEntityUploadURL();
  res.json({ uploadURL });
});

router.put("/api/journal-photos", isAuthenticated, async (req: any, res: Response) => {
  if (!req.body.photoURL) {
    return res.status(400).json({ error: "photoURL is required" });
  }

  const userId = req.user.claims.sub;

  try {
    const objectStorageService = new ObjectStorageService();
    const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
      req.body.photoURL,
      {
        owner: userId,
        visibility: "private",
      },
    );

    res.status(200).json({
      objectPath: objectPath,
    });
  } catch (error) {
    console.error("Error setting photo ACL:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res: Response) => {
  const userId = req.user?.claims?.sub;
  const objectStorageService = new ObjectStorageService();
  try {
    const objectFile = await objectStorageService.getObjectEntityFile(
      req.path,
    );
    const canAccess = await objectStorageService.canAccessObjectEntity({
      objectFile,
      userId: userId,
    });
    if (!canAccess) {
      return res.sendStatus(401);
    }
    objectStorageService.downloadObject(objectFile, res);
  } catch (error) {
    console.error("Error checking object access:", error);
    if (error instanceof ObjectNotFoundError) {
      return res.sendStatus(404);
    }
    return res.sendStatus(500);
  }
});

// Stripe Billing Routes
import { stripe, STRIPE_PRICE_IDS } from "./stripe";

router.post("/api/billing/create-checkout-session", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { priceId } = req.body;
    
    if (!priceId || !Object.values(STRIPE_PRICE_IDS).includes(priceId)) {
      return res.status(400).json({ error: "Invalid price ID" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    // Get or create subscription record
    let subscription = await storage.getSubscription(family.id);
    let stripeCustomerId: string;

    if (subscription?.stripeCustomerId) {
      stripeCustomerId = subscription.stripeCustomerId;
    } else {
      // Create Stripe customer
      const user = await storage.getUser(req.user.id);
      const customer = await stripe.customers.create({
        email: user?.email || undefined,
        metadata: {
          familyId: family.id,
          userId: req.user.id,
        },
      });
      stripeCustomerId = customer.id;

      // Save customer ID
      await storage.upsertSubscription({
        familyId: family.id,
        stripeCustomerId,
        status: "inactive",
        plan: "basic",
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.REPL_ID ? `https://${process.env.REPL_ID}.${process.env.REPLIT_DOMAINS}` : 'http://localhost:5000'}/dashboard?success=true`,
      cancel_url: `${process.env.REPL_ID ? `https://${process.env.REPL_ID}.${process.env.REPLIT_DOMAINS}` : 'http://localhost:5000'}/pricing?canceled=true`,
      metadata: {
        familyId: family.id,
      },
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("Checkout session error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/billing/create-portal-session", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const subscription = await storage.getSubscription(family.id);
    if (!subscription?.stripeCustomerId) {
      return res.status(400).json({ error: "No subscription found" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.REPL_ID ? `https://${process.env.REPL_ID}.${process.env.REPLIT_DOMAINS}` : 'http://localhost:5000'}/dashboard`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("Portal session error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/billing/subscription", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      // Return neutral payload for users who haven't onboarded yet
      return res.json({ status: "inactive", plan: "none" });
    }

    const subscription = await storage.getSubscription(family.id);
    if (!subscription) {
      // Return neutral payload for families without subscriptions
      return res.json({ status: "inactive", plan: "none" });
    }

    res.json(subscription);
  } catch (error: any) {
    console.error("Get subscription error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/billing/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return res.status(400).send("Webhook signature missing");
  }

  try {
    // Use raw body for signature verification (set up in server/index.ts)
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      return res.status(400).send("Raw body missing");
    }

    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      webhookSecret
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const familyId = session.metadata.familyId;
        
        if (session.mode === "subscription") {
          const subscriptionId = session.subscription;
          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = stripeSubscription.items.data[0].price.id;
          
          const plan = priceId === STRIPE_PRICE_IDS.pro ? "pro" : "basic";

          await storage.upsertSubscription({
            familyId,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: priceId,
            status: "active",
            plan,
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
            cancelAtPeriodEnd: false,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        
        // Try to find subscription by stripeSubscriptionId first, then by customer ID
        let existingSubscription = await storage.getSubscriptionByStripeId(subscription.id);
        if (!existingSubscription) {
          existingSubscription = await storage.getSubscriptionByCustomerId(subscription.customer);
        }

        if (existingSubscription && subscription.items?.data?.length > 0) {
          const priceId = subscription.items.data[0].price.id;
          const plan = priceId === STRIPE_PRICE_IDS.pro ? "pro" : "basic";

          const updates: any = {
            status: subscription.status,
            plan,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          };

          // Only set Stripe IDs if they're present (don't overwrite with null)
          if (subscription.id) {
            updates.stripeSubscriptionId = subscription.id;
          }
          if (priceId) {
            updates.stripePriceId = priceId;
          }

          // Use familyId-based update to ensure it works for both legacy and new records
          await storage.updateSubscription(existingSubscription.familyId, updates);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        
        // Try to find subscription by stripeSubscriptionId first, then by customer ID
        let existingSubscription = await storage.getSubscriptionByStripeId(subscription.id);
        if (!existingSubscription) {
          existingSubscription = await storage.getSubscriptionByCustomerId(subscription.customer);
        }

        if (existingSubscription) {
          // Clear all Stripe identifiers so the family can subscribe again later
          // Keep stripeCustomerId for potential future subscriptions
          // Use familyId-based update to ensure it works for both legacy and new records
          await storage.updateSubscription(existingSubscription.familyId, {
            status: "canceled",
            stripeSubscriptionId: null as any,
            stripePriceId: null as any,
            currentPeriodEnd: null as any,
            cancelAtPeriodEnd: false,
          });
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// Global collaboration service instance for route access
let collaborationService: CollaborationService | null = null;

export function getCollaborationService(): CollaborationService | null {
  return collaborationService;
}

export async function registerRoutes(app: Express) {
  const server = createServer(app);

  // Setup authentication
  const sessionMiddleware = await setupAuth(app);

  // Setup WebSocket collaboration with auth validator
  const authValidator = async (req: any) => {
    try {
      // Get session from request (Replit Auth stores user in session)
      if (!req.session || !req.session.passport || !req.session.passport.user) {
        return null;
      }

      const sessionUser = req.session.passport.user;
      const userId = sessionUser.claims.sub;
      
      if (!userId) return null;

      // Get the user's family
      const family = await storage.getFamily(userId);
      if (!family) return null;

      // Get user details from storage or session
      const user = await storage.getUser(userId);
      const userName = user 
        ? `${user.firstName} ${user.lastName}`.trim() 
        : sessionUser.claims.email?.split('@')[0] || "User";

      return { 
        userId, 
        userName, 
        familyId: family.id 
      };
    } catch (error) {
      console.error("WebSocket auth validation failed:", error);
      return null;
    }
  };

  collaborationService = new CollaborationService(server, storage, authValidator, sessionMiddleware);

  // Register all routes
  app.use(router);

  return server;
}
