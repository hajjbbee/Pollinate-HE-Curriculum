import { Router, type Request, type Response, type Express } from "express";
import { storage } from "./storage";
import { insertFamilySchema, insertChildSchema, insertJournalEntrySchema, type CurriculumData, type WeekCurriculum, curriculumDataSchema } from "@shared/schema";
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

  const systemPrompt = `You are the world's most sophisticated hybrid homeschool curriculum engine, seamlessly blending ALL of these approaches in every single suggestion:

• Child-led & Unschooling (follow the child's spark, strewing, rabbit holes)
• Charlotte Mason (living books, narration, nature study, short lessons, habit training)
• Montessori (hands-on materials, self-directed, practical life, cosmic education)
• Waldorf / Steiner (imagination first, head-heart-hands, rhythm & seasons, storytelling, beeswax, watercolour, form drawing, festivals)
• Gameschooling (board games, card games, RPGs, active play as core learning)
• Nature-Based & Seasonal Living (outdoor time daily, wonder walks, nature table, seasonal crafts)
• Inquiry-Based & Project-Based Learning (big questions, long-term projects, real-world application)
• Art-Based Pedagogy (process art, main lesson books, music, movement, drama)
• STEAM / STEM (authentic science, technology, engineering, arts, math woven naturally — never forced worksheets)

Rules that must be followed in EVERY output:
1. Never default to worksheets or screens — default to real books, real materials, real world, real play
2. Prioritise beauty, wonder, and joy — learning must feel magical
3. Balance head (thinking), heart (feeling/awe), hands (doing/making) every single day
4. Weave in seasonal/festival tie-ins when relevant (e.g. beeswax candles for Advent, watercolour leaves in autumn)
5. Always offer artistic expression (drawing, painting, modelling, music, storytelling, drama)
6. Include movement, rhythm, and play every day
7. Use games wherever possible (math → board game, history → timeline card game, science → inquiry scavenger hunt)
8. Inquiry questions first → facts later (Waldorf style)
9. DEPTH OVER BREADTH - When a child shows high interest, dive deep
10. MASTERY LEVELS - Track progression: Exposure → Developing → Strong → Mastery → Mentor
11. FAMILY THEMES - Unite siblings with shared themes while honoring individual paths
12. LOCAL OPPORTUNITIES - Integrate real-world educational experiences

When generating the 3 Confidence-Boosting Examples, explicitly draw from the pedagogies above and label them subtly with pedagogy icons:
🎲 Gameschooling | 🍃 Nature/Waldorf | ⭐ Steiner Imaginative | 🎨 Art/STEAM | 🔍 Inquiry

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
   - CRITICAL: For each main learning activity (not simple tasks like "read aloud"), include 3 confidence-boosting examples:
     * Quick & Easy (5-15 min, household items): Simple hands-on activity using recycled/household materials
     * Medium Adventure (20-45 min, low-cost or free): Outdoor or community-based activity
     * Deep-Dive Rabbit Hole (1-3 hours OR multi-day): Extended project perfect for high-interest deep work
     * Each example MUST include age range (e.g., "great for ages 4-8", "brilliant for ages 12+")
     * Prioritise hands-on, real-world, multi-sensory approaches
     * For read-alouds or videos, provide 3 different book/video options (YouTube, Librivox, library)
   - Mastery updates (3-5 subjects with current level: Exposure, Developing, Strong, Mastery, or Mentor)
4. Include 3-8 local opportunities per week with:
   - Name and address
   - Drive time in minutes
   - Cost (Free, $, $$, $$$)
   - Why this fits the curriculum
   - Suggested dates/times
   - Website link (if available)
5. Include 9-12 resources per week across THREE categories:
   - FREE (3-4): YouTube channels/videos, Khan Academy, BBC Bitesize, Librivox audiobooks, free printables, library books
   - LOW-COST under $15 (3-4): Thriftbooks, BookOutlet, Etsy printables, TeachersPayTeachers  
   - RECYCLED/HOUSEHOLD/NATURE (3-4): DIY projects using cardboard, bottles, leaves, kitchen items, household objects
   PRIORITIZE recycled/household resources - huge selling point! Keep descriptions concise.

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
            "Monday": [
              {
                "activity": "Explore how mountains are formed",
                "examples": {
                  "quickEasy": {
                    "title": "Quick & Easy (5-15 min, household items)",
                    "description": "Grab a tray of sand or dirt. Build a small hill and slowly pour water on one side — watch erosion create valleys in real time!",
                    "ageRange": "great for ages 4-8",
                    "pedagogy": "🍃 Nature/Waldorf"
                  },
                  "mediumAdventure": {
                    "title": "Medium Adventure (20-45 min, low-cost or free)",
                    "description": "Head to a local park or hiking trail. Look for different rock layers on a hill cut-away. Take photos and compare to library books about plate tectonics.",
                    "ageRange": "perfect for ages 8-12",
                    "pedagogy": "🔍 Inquiry"
                  },
                  "deepDive": {
                    "title": "Deep-Dive Rabbit Hole (1-3 hours OR multi-day project)",
                    "description": "Make a working volcano model with baking soda, vinegar, and food colouring. Film it erupting from multiple angles, then edit a slow-motion video and label the geological processes (great for teens who love filming or chemistry).",
                    "ageRange": "brilliant for ages 12+",
                    "pedagogy": "🎨 Art/STEAM"
                  }
                }
              },
              "Morning nature walk",
              "Sketch birds observed"
            ],
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
          "title": "Khan Academy: Ecosystems",
          "link": "https://www.khanacademy.org/science/biology/ecology",
          "description": "Free video lessons on food chains and energy flow",
          "category": "free"
        },
        {
          "title": "Cardboard Bird Feeder",
          "description": "Use milk carton, string, and birdseed to observe local birds",
          "category": "recycled"
        },
        {
          "title": "Leaf Pressing Kit",
          "description": "Collect leaves, press in books, identify species",
          "category": "recycled"
        },
        {
          "title": "Nat Geo Kids: Birds",
          "link": "https://kids.nationalgeographic.com/animals/birds",
          "description": "Free bird facts and videos",
          "category": "free"
        },
        {
          "title": "Used Field Guide (Thriftbooks)",
          "link": "https://www.thriftbooks.com",
          "description": "Peterson or Sibley guides, $8-12",
          "category": "low-cost"
        },
        {
          "title": "DIY Stream Study",
          "description": "Mason jars, coffee filters for water testing",
          "category": "recycled"
        },
        {
          "title": "Ecosystem Printables (TPT)",
          "link": "https://www.teacherspayteachers.com",
          "description": "Food web diagrams, free-$3",
          "category": "low-cost"
        }
      ]
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: "anthropic/claude-3.5-sonnet",
    max_tokens: 6000,
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

  // Parse JSON
  let parsedData;
  try {
    parsedData = JSON.parse(cleanedResponse);
  } catch (parseError: any) {
    console.error("Failed to parse AI curriculum response:", parseError.message);
    console.error("Response text:", cleanedResponse.substring(0, 500));
    throw new Error("AI generated invalid JSON. Please try regenerating the curriculum.");
  }

  // Validate with Zod schema
  const validationResult = curriculumDataSchema.safeParse(parsedData);
  
  if (!validationResult.success) {
    console.error("Curriculum validation failed:", validationResult.error.format());
    console.error("Parsed data structure:", JSON.stringify(parsedData, null, 2).substring(0, 1000));
    throw new Error(`AI generated curriculum doesn't match expected structure: ${validationResult.error.message}`);
  }

  return validationResult.data;
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
    let curriculumGenerationMessage = null;
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
      
      // Check for specific error types and set user-friendly messages
      if (aiError.message?.includes("credit") || aiError.message?.includes("afford") || aiError.status === 402) {
        curriculumGenerationMessage = "Curriculum generation temporarily unavailable. You can generate your curriculum later from Settings.";
        console.error("OpenRouter credits exhausted. User can regenerate later.");
      } else if (aiError.message?.includes("API key") || aiError.status === 401) {
        curriculumGenerationMessage = "Curriculum generation configuration error. Please contact support.";
        console.error("OpenRouter API key error.");
      } else {
        curriculumGenerationMessage = "Curriculum generation failed. You can regenerate from Settings.";
        console.error("Unknown curriculum generation error:", aiError.message);
      }
      
      // Continue with onboarding completion despite curriculum generation failure
      console.warn("Curriculum generation failed, but onboarding will complete. User can regenerate later.");
    }

    res.json({ 
      family, 
      children: createdChildren,
      warning: curriculumGenerationMessage 
    });
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

// Update family settings
router.put("/api/family/settings", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    // Validate request body
    const settingsSchema = z.object({
      familyName: z.string().min(1),
      country: z.string(),
      address: z.string(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      travelRadiusMinutes: z.number().min(5).max(120),
      flexForHighInterest: z.boolean(),
      children: z.array(
        z.object({
          id: z.string().optional(),
          name: z.string().min(1),
          birthdate: z.string(),
          interests: z.array(z.string()),
          learningStyle: z.string().nullable(),
        })
      ).min(1),
    });

    const validatedData = settingsSchema.parse(req.body);
    const { familyName, country, address, lat, lng, travelRadiusMinutes, flexForHighInterest, children } = validatedData;

    // Geocode address if lat/lng not provided
    let coordinates = { lat, lng };
    if (!lat || !lng) {
      console.log("Geocoding address:", address);
      coordinates = await geocodeAddress(address, country);
    }

    // Update family data
    await storage.updateFamily(req.user.id, {
      familyName,
      country,
      address,
      latitude: coordinates.lat,
      longitude: coordinates.lng,
      travelRadiusMinutes,
      flexForHighInterest,
    });

    // Update children - diff against existing to preserve IDs
    const existingChildren = await storage.getChildren(family.id);
    const existingChildIds = new Set(existingChildren.map(c => c.id));
    const keptChildIds = new Set<string>();

    // Update existing children and create new ones
    for (const childData of children) {
      if (childData.id && existingChildIds.has(childData.id)) {
        // Update existing child
        await storage.updateChild(childData.id, {
          name: childData.name,
          birthdate: childData.birthdate,
          interests: childData.interests,
          learningStyle: childData.learningStyle || null,
        });
        keptChildIds.add(childData.id);
      } else {
        // Create new child (no ID or ID not found)
        const newChild = await storage.createChild({
          familyId: family.id,
          name: childData.name,
          birthdate: childData.birthdate,
          interests: childData.interests,
          learningStyle: childData.learningStyle || null,
        });
        keptChildIds.add(newChild.id);
      }
    }

    // Delete children that were removed (not in keptChildIds)
    for (const existingChild of existingChildren) {
      if (!keptChildIds.has(existingChild.id)) {
        await storage.deleteChild(existingChild.id);
      }
    }

    // Clear local opportunities cache so they'll be regenerated with new location
    await storage.deleteOpportunitiesByFamily(family.id);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Update family settings error:", error);
    res.status(500).json({ error: error.message || "Failed to update family settings" });
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
    
    // Check for OpenRouter credit exhaustion (402 Payment Required)
    if (error.status === 402 || error.message?.includes("credit") || error.message?.includes("max_tokens")) {
      return res.status(402).json({ 
        message: "Curriculum generation requires additional OpenRouter credits. Please contact support or add credits at openrouter.ai",
        code: "INSUFFICIENT_CREDITS"
      });
    }
    
    // Check for other API authentication issues
    if (error.status === 401 || error.message?.includes("API key")) {
      return res.status(502).json({ 
        message: "AI service configuration error. Please contact support.",
        code: "API_CONFIG_ERROR"
      });
    }
    
    // Generic error for other cases
    res.status(502).json({ 
      message: error.message || "Failed to generate curriculum",
      code: "GENERATION_ERROR"
    });
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

// Voice journal with AI interest signal extraction
router.post("/api/journal-voice", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const { transcript, childId } = req.body;
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: "Transcript is required" });
    }

    // Get children for context
    const children = await storage.getChildren(family.id);
    if (children.length === 0) {
      return res.status(400).json({ error: "No children found in family" });
    }

    // Determine which child this entry is for
    let targetChildId = childId;
    if (!targetChildId && children.length === 1) {
      // If only one child, assign to them
      targetChildId = children[0].id;
    } else if (!targetChildId) {
      // Multiple children - use AI to detect which child
      const childDetectionPrompt = `Given this voice journal transcript about today's learning, which child is this about?

Children: ${children.map((c, i) => `${i + 1}. ${c.name} (age ${c.age})`).join(', ')}

Transcript: "${transcript}"

Respond with ONLY the child's number (1, 2, 3, etc.). If you can't determine, respond with "1".`;

      const detectionResponse = await openai.chat.completions.create({
        model: "anthropic/claude-3.5-sonnet",
        messages: [{ role: "user", content: childDetectionPrompt }],
        temperature: 0,
        max_tokens: 10,
      });

      const detectedIndex = parseInt(detectionResponse.choices[0].message.content?.trim() || "1") - 1;
      targetChildId = children[Math.max(0, Math.min(detectedIndex, children.length - 1))].id;
    }

    const curriculum = await storage.getCurriculum(family.id);
    const targetChild = children.find(c => c.id === targetChildId);

    // Extract interest signals using Claude
    const systemPrompt = `You are an educational AI assistant that analyzes voice journal entries from homeschool families to extract interest signals and learning patterns.

Current family context:
- This entry is about: ${targetChild?.name} (age ${targetChild?.age})
- All children: ${children.map(c => `${c.name} (age ${c.age})`).join(', ')}
- Current curriculum theme: ${curriculum?.curriculumData ? (curriculum.curriculumData as CurriculumData).weeks[0]?.familyTheme : 'Not available'}

Your task is to:
1. Summarize the journal entry in 2-3 sentences
2. Identify any new interests, topics, or learning directions mentioned
3. Detect enthusiasm or engagement patterns
4. Note any subjects or activities the child wants to explore more
5. Extract specific skills or concepts demonstrated

Respond in JSON format:
{
  "summary": "Brief summary of the journal entry",
  "interests": ["interest1", "interest2"],
  "skills": ["skill1", "skill2"],
  "enthusiasm": "high|medium|low",
  "notes": "Any additional observations about learning progress or engagement"
}`;

    const completion = await openai.chat.completions.create({
      model: "anthropic/claude-3.5-sonnet",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Voice journal transcript:\n\n${transcript}` }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const analysis = JSON.parse(completion.choices[0].message.content || '{}');

    // Create journal entry with structured AI analysis in content
    const enhancedContent = `${transcript}

---
AI Analysis
Summary: ${analysis.summary || 'No summary available'}
Interests: ${analysis.interests?.join(', ') || 'None detected'}
Skills: ${analysis.skills?.join(', ') || 'None detected'}
Engagement: ${analysis.enthusiasm || 'Not detected'}
Notes: ${analysis.notes || 'None'}`;

    const entry = await storage.createJournalEntry({
      childId: targetChildId,
      familyId: family.id,
      entryDate: new Date().toISOString().split('T')[0],
      content: transcript, // Store original transcript
      photoUrls: [],
      aiAnalysis: analysis, // Store structured analysis separately
    });

    res.json({ 
      entry, 
      analysis,
      childName: targetChild?.name 
    });
  } catch (error: any) {
    console.error('Voice journal error:', error);
    res.status(500).json({ error: error.message || 'Failed to process voice journal' });
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

// Activity Feedback (emoji reactions for planned activities)
router.post("/api/activity-feedback", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const { childId, activityId, activityDate, reaction, notes, voiceNoteUrl, photoUrl } = req.body;

    const feedback = await storage.createActivityFeedback({
      familyId: family.id,
      childId,
      activityId,
      activityDate,
      reaction,
      notes,
      voiceNoteUrl,
      photoUrl,
    });

    res.json(feedback);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/activity-feedback/:activityId/:date", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const { activityId, date } = req.params;
    const feedback = await storage.getActivityFeedback(activityId, date);
    
    res.json(feedback || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/api/activity-feedback/:feedbackId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const { feedbackId } = req.params;
    const updates = req.body;

    const feedback = await storage.updateActivityFeedback(feedbackId, updates);
    res.json(feedback);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Emerging Interest Signals (free-form spontaneous obsessions)
router.post("/api/emerging-interests", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const { childId, title, description, voiceNoteUrl, photoUrl, source } = req.body;

    const signal = await storage.createEmergingInterest({
      familyId: family.id,
      childId,
      source: source || "free_form",
      title,
      description,
      voiceNoteUrl,
      photoUrl,
      priorityScore: 100, // High priority by default
      scheduled: false,
    });

    res.json(signal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/emerging-interests/:childId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const { childId } = req.params;
    const signals = await storage.getEmergingInterests(childId, family.id);
    
    res.json(signals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/emerging-interests-recent/:childId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const { childId } = req.params;
    const { days } = req.query;
    const signals = await storage.getRecentEmergingInterests(childId, days ? parseInt(days as string) : 30);
    
    res.json(signals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/api/emerging-interests/:signalId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const { signalId } = req.params;
    const updates = req.body;

    const signal = await storage.updateEmergingInterest(signalId, updates);
    res.json(signal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Support Tickets
router.post("/api/support", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);

    const { message, screenshotUrl } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    const ticket = await storage.createSupportTicket({
      familyId: family?.id || null,
      userEmail: req.user.email || "unknown@pollinate.app",
      userName: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || "Pollinate User",
      message: message.trim(),
      screenshotUrl: screenshotUrl || null,
      status: "new",
    });

    // Send email notification using basic fetch to a simple email service
    // For now, we'll use a simple fetch to send the email
    try {
      const supportEmail = "pollinatecurriculum@proton.me";
      const subject = `[Pollinate Support] New message from ${ticket.userName}`;
      const emailBody = `
New support message from ${ticket.userName} (${ticket.userEmail})
Family: ${family.familyName}

Message:
${ticket.message}

${screenshotUrl ? `Screenshot: ${screenshotUrl}` : "No screenshot attached"}

---
Ticket ID: ${ticket.id}
Created: ${ticket.createdAt}
      `.trim();

      // Simple email sending via fetch (we'll use a basic SMTP or email API later)
      // For now, just log it - the user can add Resend/SendGrid integration later
      console.log(`[SUPPORT TICKET] ${subject}\n${emailBody}`);
      console.log(`[ACTION REQUIRED] Send this to: ${supportEmail}`);
      
    } catch (emailError) {
      console.error("Failed to send support email:", emailError);
      // Don't fail the request if email fails - ticket is still saved
    }

    res.json(ticket);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Streak tracking
router.post("/api/daily-completion", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const { date, completed, total, completedIds } = req.body;
    await storage.upsertDailyCompletion(family.id, date, completed, total, completedIds || []);
    
    const streak = await storage.getCurrentStreak(family.id);
    res.json({ streak });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/daily-completion/:date", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const { date } = req.params;
    const completion = await storage.getDailyCompletion(family.id, date);
    res.json(completion || { completed: 0, total: 0, completedIds: [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/streak", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const streak = await storage.getCurrentStreak(family.id);
    res.json({ streak });
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

    const now = new Date();
    const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours
    
    // ALWAYS fetch events for the next 14 days, regardless of which week is being viewed
    const next14DaysStart = new Date();
    const next14DaysEnd = new Date();
    next14DaysEnd.setDate(next14DaysEnd.getDate() + 14);

    // Get all cached events for this family in the next 14 days
    let cachedEvents = await storage.getUpcomingEvents(family.id, next14DaysStart, next14DaysEnd);
    
    // Determine if we need to refresh the cache
    let shouldRefreshCache = false;
    
    if (cachedEvents.length === 0) {
      shouldRefreshCache = true;
      console.log(`🎪 No cached events for week ${weekNumber}, discovering new events...`);
    } else {
      // Check if cache is stale (any event older than 6 hours)
      const oldestCacheTime = Math.min(...cachedEvents.map(e => {
        const cachedAt = e.cachedAt ? new Date(e.cachedAt).getTime() : 0;
        return cachedAt;
      }));
      
      if (now.getTime() - oldestCacheTime > CACHE_DURATION_MS) {
        shouldRefreshCache = true;
        console.log(`♻️  Cache stale for week ${weekNumber} (age: ${Math.round((now.getTime() - oldestCacheTime) / 1000 / 60)} minutes), refreshing...`);
        
        // Delete ALL cached events for this week before refreshing
        for (const event of cachedEvents) {
          try {
            await storage.deleteEvent(event.id);
          } catch (err) {
            console.error("Error deleting stale event:", err);
          }
        }
      } else {
        console.log(`✨ Using cached events for week ${weekNumber} (age: ${Math.round((now.getTime() - oldestCacheTime) / 1000 / 60)} minutes)`);
      }
    }

    // Refresh cache if needed
    if (shouldRefreshCache) {
      const { discoverWeeklyEvents } = await import("./events");
      const curriculum = await storage.getActiveCurriculum(family.id);
      
      if (curriculum) {
        const curriculumData = curriculum.curriculumData as any;
        const weekTheme = curriculumData.weeks[weekNumber - 1]?.familyTheme || "education";
        console.log(`🎯 Week ${weekNumber} theme: "${weekTheme}" (fetching events for next 14 days)`);
        
        const radiusKm = (family.travelRadiusMinutes / 60) * 50; // Assume 50 km/h average speed
        
        // Get connected Facebook groups for event discovery
        const facebookGroups = await storage.getHomeschoolGroups(family.id);
        console.log(`👥 Including ${facebookGroups.length} Facebook groups in event discovery`);
        
        // Fetch events for the next 14 days matching this week's theme
        const newEvents = await discoverWeeklyEvents(
          family.id,
          family.latitude,
          family.longitude,
          radiusKm,
          weekTheme,
          next14DaysStart,
          facebookGroups
        );

        console.log(`📅 Discovered ${newEvents.length} events for next 14 days (theme: ${weekTheme})`);

        // Save to database with current timestamp
        for (const event of newEvents) {
          try {
            await storage.createEvent(event as any);
          } catch (err) {
            console.error("Error saving event:", err);
          }
        }

        // Reload from database to get fresh cached events
        cachedEvents = await storage.getUpcomingEvents(family.id, next14DaysStart, next14DaysEnd);
        console.log(`✅ Cached ${cachedEvents.length} events for next 14 days (valid for 6 hours)`);
      } else {
        console.log(`⚠️ No curriculum found for family ${family.id}`);
      }
    }

    // Events are already filtered to next 14 days by the storage query
    // Just ensure they haven't passed yet
    const upcomingEvents = cachedEvents.filter(e => {
      const eventDate = new Date(e.eventDate);
      return eventDate >= now;
    });

    console.log(`📤 Returning ${upcomingEvents.length} upcoming events (filtered from ${cachedEvents.length} cached)`);
    res.json(upcomingEvents);
  } catch (error: any) {
    console.error("Error fetching events:", error);
    res.status(500).json({ error: error.message });
  }
});

// Homeschool Groups routes
router.get("/api/groups", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const groups = await storage.getHomeschoolGroups(family.id);
    res.json(groups);
  } catch (error: any) {
    console.error("Error fetching groups:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/groups", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const { groupUrl, groupName } = req.body;
    
    if (!groupUrl || !groupName) {
      return res.status(400).json({ error: "groupUrl and groupName are required" });
    }

    // Extract group ID from URL (handles various Facebook group URL formats)
    const extractGroupId = (url: string): string => {
      // https://www.facebook.com/groups/denverwildandfree
      // https://www.facebook.com/groups/123456789012345
      // https://m.facebook.com/groups/groupname
      const match = url.match(/groups\/([^/?]+)/);
      return match ? match[1] : url;
    };

    const groupId = extractGroupId(groupUrl);

    const group = await storage.createHomeschoolGroup({
      familyId: family.id,
      groupId,
      groupName,
      groupUrl,
      syncStatus: "manual", // MVP: all groups are manually managed
    });

    res.json(group);
  } catch (error: any) {
    console.error("Error creating group:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/api/groups/:groupId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const group = await storage.getHomeschoolGroupById(req.params.groupId);
    if (!group || group.familyId !== family.id) {
      return res.status(404).json({ error: "Group not found" });
    }

    await storage.deleteHomeschoolGroup(req.params.groupId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting group:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/groups/:groupId/events", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const group = await storage.getHomeschoolGroupById(req.params.groupId);
    if (!group || group.familyId !== family.id) {
      return res.status(404).json({ error: "Group not found" });
    }

    const { eventName, eventDate, location, cost, description, ticketUrl } = req.body;
    
    if (!eventName || !eventDate || !location) {
      return res.status(400).json({ error: "eventName, eventDate, and location are required" });
    }

    const event = await storage.createEvent({
      familyId: family.id,
      eventName,
      eventDate: new Date(eventDate),
      location,
      cost: cost || "FREE",
      category: "community", // Default category for group events
      source: "facebook_group",
      groupId: group.groupId,
      groupName: group.groupName,
      description,
      ticketUrl,
      whyItFits: null, // Will be set when matched to curriculum theme
    });

    res.json(event);
  } catch (error: any) {
    console.error("Error creating group event:", error);
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
