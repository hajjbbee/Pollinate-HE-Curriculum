import { Router, type Request, type Response, type Express } from "express";
import { storage } from "./storage";
import { insertFamilySchema, insertChildSchema, insertJournalEntrySchema, insertTranscriptCourseSchema, insertCreditMappingSchema, type CurriculumData, type WeekCurriculum, curriculumDataSchema } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { createServer } from "http";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { CollaborationService } from "./websocket";
import PDFDocument from "pdfkit";
import { addDays, parseISO, format as formatDate } from "date-fns";
import { getStandardConfig, getProgressLabel } from "@shared/standardsConfig";
import { generateUSTranscript, generateUKTranscript, generateIBTranscript, generateANZTranscript, generateEUTranscript, generateClassicalTranscript } from "./transcriptPdfGenerators";

const router = Router();

// Validate required API keys at startup
if (!process.env.XAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
  console.error("FATAL: Neither XAI_API_KEY nor ANTHROPIC_API_KEY is set. Curriculum generation will fail.");
}
if (!process.env.GOOGLE_MAPS_API_KEY) {
  console.error("FATAL: GOOGLE_MAPS_API_KEY is not set. Geocoding and opportunities search will fail.");
}

// Initialize xAI client (primary) - OpenAI-compatible API
const xaiClient = process.env.XAI_API_KEY ? new OpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.XAI_API_KEY,
}) : null;

// Initialize Anthropic client (fallback)
const anthropicClient = process.env.ANTHROPIC_API_KEY ? new OpenAI({
  baseURL: "https://api.anthropic.com/v1",
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    "anthropic-version": "2023-06-01",
  },
}) : null;

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
  localOpps: any[],
  familyApproach?: string | null
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
    
    // Collect learning needs profiles
    const learningNeeds: string[] = [];
    if (child.hasAdhd) {
      learningNeeds.push(`ADHD (intensity ${child.adhdIntensity}/10) - needs shorter lessons, movement breaks, fidget ideas`);
    }
    if (child.hasAutism) {
      learningNeeds.push(`Sensory sensitivities (intensity ${child.autismIntensity}/10) - needs visual schedules, predictability, sensory supports`);
    }
    if (child.isGifted) {
      learningNeeds.push(`Gifted - benefits from advanced concepts, depth over breadth, interest-based intensity`);
    }
    if (child.is2e) {
      learningNeeds.push(`2e (Twice Exceptional) - combine challenge with support, honor both giftedness and learning differences`);
    }
    if (child.hasDyslexia) {
      learningNeeds.push(`Dyslexia (intensity ${child.dyslexiaIntensity}/10) - needs oral options, audiobooks, reduced written work`);
    }
    if (child.hasDysgraphia) {
      learningNeeds.push(`Dysgraphia (intensity ${child.dysgraphiaIntensity}/10) - needs typing options, reduced writing, alternative outputs`);
    }
    if (child.hasDyscalculia) {
      learningNeeds.push(`Dyscalculia (intensity ${child.dyscalculiaIntensity}/10) - needs manipulatives, visual maths, extra time, calculators`);
    }
    if (child.hasAnxiety) {
      learningNeeds.push(`Anxiety (intensity ${child.anxietyIntensity}/10) - needs choice boards, reduced pressure, gentle encouragement`);
    }
    if (child.isPerfectionist) {
      learningNeeds.push(`Perfectionism - needs growth mindset language, "good enough" practice, low-stakes attempts`);
    }
    
    return {
      name: child.name,
      age,
      interests: child.interests || [],
      learningStyle: child.learningStyle || "Mixed",
      learningNeeds: learningNeeds.length > 0 ? learningNeeds : null,
    };
  });
  
  // Map approach code to name and emphasis
  const approachMap: Record<string, { name: string; emphasis: string }> = {
    "perfect-blend": { 
      name: "Perfect Blend (AI Recommended)", 
      emphasis: "Seamlessly blend ALL pedagogies with balanced emphasis. Use AI discretion to match activities to each child's age and interests." 
    },
    "charlotte-mason": { 
      name: "Charlotte Mason", 
      emphasis: "PRIORITIZE living books, narration, nature study, short lessons, habit training, and feast over famine. Weave in other methods but keep Charlotte Mason principles central." 
    },
    "montessori": { 
      name: "Montessori", 
      emphasis: "PRIORITIZE hands-on materials, self-directed activities, practical life skills, and cosmic education. Use mixed-age activities where possible." 
    },
    "waldorf": { 
      name: "Waldorf/Steiner", 
      emphasis: "PRIORITIZE imagination-first storytelling, head-heart-hands balance, seasonal rhythms, festivals, artistic expression (watercolour, beeswax, form drawing), and movement. Keep screens minimal." 
    },
    "unschooling": { 
      name: "Unschooling/Child-Led", 
      emphasis: "PRIORITIZE following the child's natural curiosity, strewing interesting materials, deep rabbit holes, real-world learning, and minimal structured lessons. Trust the child's intrinsic motivation." 
    },
    "project-based": { 
      name: "Project-Based Learning", 
      emphasis: "PRIORITIZE long-term projects, big driving questions, real-world application, exhibitions of learning, and cross-disciplinary integration. Make learning tangible and purposeful." 
    },
    "nature-based": { 
      name: "Nature-Based/Forest School", 
      emphasis: "PRIORITIZE outdoor time daily, nature connection, seasonal living, wonder walks, nature tables, mud kitchens, and risky play. Bring learning outside whenever possible." 
    },
    "gameschooling": { 
      name: "Gameschooling", 
      emphasis: "PRIORITIZE board games, card games, RPGs, and active play as core learning vehicles. Make math, history, strategy, and logic fun through gameplay." 
    },
    "steam": { 
      name: "STEAM/STEM", 
      emphasis: "PRIORITIZE hands-on science experiments, engineering challenges, technology integration (coding, robotics), arts integration, and mathematical thinking. Keep it inquiry-driven, not worksheet-driven." 
    }
  };

  const selectedApproach = approachMap[familyApproach || "perfect-blend"];

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

NEURODIVERGENT ADAPTATIONS - When a child has learning needs, automatically adapt activities:
• ADHD: Shorter lessons (10-15 min), built-in movement breaks every 20 minutes, fidget-friendly activities (play dough while listening, squeeze ball during reading), timer games, high-energy outdoor options
• Sensory sensitivities: Visual schedules (picture cards showing the day), predictable routines, sensory supports (quiet space option, headphones, weighted blanket, heavy work options, movement breaks, textured materials), clear start/end times, minimal transitions, reduce visual/auditory clutter
• Gifted: Advanced concepts, depth over breadth, abstract thinking challenges, mentorship opportunities, passion projects that span weeks
• 2e (Twice Exceptional): Combine advanced content with scaffolding, honor strengths while supporting challenges, allow multiple ways to demonstrate learning
• Dyslexia: Oral response options, audiobooks (YouTube, Librivox), parent reads aloud, minimal writing requirements, voice-to-text, graphic novels
• Dysgraphia: Typing instead of handwriting, voice-to-text apps, video reports instead of written, reduced copy work, alternative outputs (model-making, oral presentation), extra time for writing tasks
• Dyscalculia: Hands-on manipulatives (counters, blocks, measuring cups), visual maths (number lines, hundred charts), calculators allowed, extra time for maths, real-world maths contexts, skip counting games
• Anxiety: Choice boards (child picks 2 of 3 activities), low-stakes "try it" language, celebrate attempts not just success, gentle encouragement, no public performance pressure
• Perfectionism: Growth mindset language ("mistakes are how we learn"), "good enough" practice, rough drafts celebrated, time limits to prevent overthinking

When generating the 3 Confidence-Boosting Examples, explicitly draw from the pedagogies above and label them subtly with pedagogy icons:
🎲 Gameschooling | 🍃 Nature/Waldorf | ⭐ Steiner Imaginative | 🎨 Art/STEAM | 🔍 Inquiry

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations.`;

  const userPrompt = `Generate a personalized 12-week rolling curriculum for the ${family.familyName}.

FAMILY CONTEXT:
- Location: ${family.city}, ${family.state}, ${family.country}
- Season: ${season}
- Travel Radius: ${family.travelRadiusMinutes} minutes
- Flex for High Interest: ${family.flexForHighInterest ? "Yes" : "No"}
- Learning Approach: ${selectedApproach.name}
  → ${selectedApproach.emphasis}

CHILDREN:
${childrenInfo.map(child => {
  let childDesc = `- ${child.name} (age ${child.age}): Interests: ${child.interests.join(", ")}; Learning style: ${child.learningStyle}`;
  if (child.learningNeeds) {
    childDesc += `\n  Learning Needs: ${child.learningNeeds.join("; ")}`;
  }
  return childDesc;
}).join("\n")}

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

  // Try xAI Grok-4 first, then fall back to Anthropic Claude
  let completion;
  let usedProvider = "unknown";
  
  try {
    if (xaiClient) {
      console.log("Using xAI Grok-4 for curriculum generation...");
      completion = await xaiClient.chat.completions.create({
        model: "grok-4",
        max_tokens: 8000,
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
      usedProvider = "xAI Grok-4";
    } else if (anthropicClient) {
      console.log("Using Anthropic Claude 3.5 Sonnet for curriculum generation...");
      completion = await anthropicClient.chat.completions.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 8000,
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
      usedProvider = "Anthropic Claude 3.5 Sonnet";
    } else {
      throw new Error("No AI provider configured. Please set XAI_API_KEY or ANTHROPIC_API_KEY.");
    }
    console.log(`Curriculum generated successfully using ${usedProvider}`);
  } catch (primaryError: any) {
    console.error(`Primary AI provider (${usedProvider}) failed:`, primaryError.message);
    
    // Try fallback if primary failed
    if (xaiClient && anthropicClient && usedProvider === "xAI Grok-4") {
      console.log("Falling back to Anthropic Claude 3.5 Sonnet...");
      try {
        completion = await anthropicClient.chat.completions.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 8000,
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
        usedProvider = "Anthropic Claude 3.5 Sonnet (fallback)";
        console.log("Fallback to Anthropic successful");
      } catch (fallbackError: any) {
        console.error("Fallback to Anthropic also failed:", fallbackError.message);
        throw primaryError; // Throw original error
      }
    } else {
      throw primaryError;
    }
  }

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
    const { familyName, country, address, travelRadiusMinutes, flexForHighInterest, learningApproach, children: childrenData } = req.body;

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

    // Save family learning approach if provided
    if (learningApproach) {
      await storage.saveFamilyApproach({
        familyId: family.id,
        approach: learningApproach,
      });
    }

    // Create children
    const createdChildren = [];
    for (const childData of childrenData) {
      const child = await storage.createChild({
        familyId: family.id,
        name: childData.name,
        birthdate: childData.birthdate,
        interests: childData.interests || [],
        learningStyle: childData.learningStyle,
        hasAdhd: childData.hasAdhd ?? false,
        adhdIntensity: childData.adhdIntensity ?? 0,
        hasAutism: childData.hasAutism ?? false,
        autismIntensity: childData.autismIntensity ?? 0,
        isGifted: childData.isGifted ?? false,
        is2e: childData.is2e ?? false,
        hasDyslexia: childData.hasDyslexia ?? false,
        dyslexiaIntensity: childData.dyslexiaIntensity ?? 0,
        hasDysgraphia: childData.hasDysgraphia ?? false,
        dysgraphiaIntensity: childData.dysgraphiaIntensity ?? 0,
        hasDyscalculia: childData.hasDyscalculia ?? false,
        dyscalculiaIntensity: childData.dyscalculiaIntensity ?? 0,
        hasAnxiety: childData.hasAnxiety ?? false,
        anxietyIntensity: childData.anxietyIntensity ?? 0,
        isPerfectionist: childData.isPerfectionist ?? false,
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
      if (!process.env.XAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        throw new Error("No AI provider configured. Please set XAI_API_KEY or ANTHROPIC_API_KEY environment variable.");
      }
      
      const curriculumData = await generateCurriculum(family, createdChildren, opportunities, learningApproach);

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

// Get family learning approach
router.get("/api/family/approach", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const approach = await storage.getFamilyApproach(family.id);
    res.json(approach || { approach: "perfect-blend" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update family learning approach
router.put("/api/family/approach", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const { approach } = req.body;
    if (!approach) {
      return res.status(400).json({ error: "Approach is required" });
    }

    await storage.saveFamilyApproach({
      familyId: family.id,
      approach,
    });

    res.json({ success: true, approach });
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
          hasAdhd: z.boolean().optional(),
          adhdIntensity: z.number().min(0).max(10).optional(),
          hasAutism: z.boolean().optional(),
          autismIntensity: z.number().min(0).max(10).optional(),
          isGifted: z.boolean().optional(),
          is2e: z.boolean().optional(),
          hasDyslexia: z.boolean().optional(),
          dyslexiaIntensity: z.number().min(0).max(10).optional(),
          hasDysgraphia: z.boolean().optional(),
          dysgraphiaIntensity: z.number().min(0).max(10).optional(),
          hasDyscalculia: z.boolean().optional(),
          dyscalculiaIntensity: z.number().min(0).max(10).optional(),
          hasAnxiety: z.boolean().optional(),
          anxietyIntensity: z.number().min(0).max(10).optional(),
          isPerfectionist: z.boolean().optional(),
          isHighSchoolMode: z.boolean().optional(),
          educationStandard: z.enum(["us", "canada", "uk", "australia-nz", "ib", "eu", "classical", "custom"]).optional(),
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

    // Get or create family record (upsert pattern for onboarding)
    let family = await storage.getFamily(req.user.id);
    if (!family) {
      console.log("Creating new family record for user:", req.user.id);
      family = await storage.createFamily({
        userId: req.user.id,
        familyName,
        country,
        address,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        travelRadiusMinutes,
        flexForHighInterest,
      });
    } else {
      // Update existing family data
      await storage.updateFamily(req.user.id, {
        familyName,
        country,
        address,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        travelRadiusMinutes,
        flexForHighInterest,
      });
    }

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
          hasAdhd: childData.hasAdhd ?? false,
          adhdIntensity: childData.adhdIntensity ?? 0,
          hasAutism: childData.hasAutism ?? false,
          autismIntensity: childData.autismIntensity ?? 0,
          isGifted: childData.isGifted ?? false,
          is2e: childData.is2e ?? false,
          hasDyslexia: childData.hasDyslexia ?? false,
          dyslexiaIntensity: childData.dyslexiaIntensity ?? 0,
          hasDysgraphia: childData.hasDysgraphia ?? false,
          dysgraphiaIntensity: childData.dysgraphiaIntensity ?? 0,
          hasDyscalculia: childData.hasDyscalculia ?? false,
          dyscalculiaIntensity: childData.dyscalculiaIntensity ?? 0,
          hasAnxiety: childData.hasAnxiety ?? false,
          anxietyIntensity: childData.anxietyIntensity ?? 0,
          isPerfectionist: childData.isPerfectionist ?? false,
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
          hasAdhd: childData.hasAdhd ?? false,
          adhdIntensity: childData.adhdIntensity ?? 0,
          hasAutism: childData.hasAutism ?? false,
          autismIntensity: childData.autismIntensity ?? 0,
          isGifted: childData.isGifted ?? false,
          is2e: childData.is2e ?? false,
          hasDyslexia: childData.hasDyslexia ?? false,
          dyslexiaIntensity: childData.dyslexiaIntensity ?? 0,
          hasDysgraphia: childData.hasDysgraphia ?? false,
          dysgraphiaIntensity: childData.dysgraphiaIntensity ?? 0,
          hasDyscalculia: childData.hasDyscalculia ?? false,
          dyscalculiaIntensity: childData.dyscalculiaIntensity ?? 0,
          hasAnxiety: childData.hasAnxiety ?? false,
          anxietyIntensity: childData.anxietyIntensity ?? 0,
          isPerfectionist: childData.isPerfectionist ?? false,
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

// Privacy & Data Management Routes

// Download all family data as ZIP
router.get("/api/family/export-data", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const allData = await storage.getAllFamilyData(req.user.id);
    
    if (!allData.family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const archiver = await import("archiver");
    const PDFDocument = (await import("pdfkit")).default;
    
    const archive = archiver.default("zip", { zlib: { level: 9 } });
    
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="pollinate-family-data-${Date.now()}.zip"`);
    
    archive.pipe(res);

    // Add JSON data file
    archive.append(JSON.stringify(allData, null, 2), { name: "family-data.json" });

    // Create comprehensive PDF summary
    const doc = new PDFDocument({ margin: 50 });
    const pdfBuffers: Buffer[] = [];
    doc.on("data", pdfBuffers.push.bind(pdfBuffers));
    
    // Header
    doc.fontSize(22).font("Helvetica-Bold").text("Pollinate Family Data Export", { align: "center" });
    doc.fontSize(12).font("Helvetica").text(`Generated on ${new Date().toLocaleDateString()}`, { align: "center" });
    doc.moveDown(2);
    
    // Family Information
    doc.fontSize(16).font("Helvetica-Bold").text("Family Information");
    doc.fontSize(12).font("Helvetica");
    doc.text(`Family Name: ${allData.family.familyName}`);
    doc.text(`Location: ${allData.family.city}, ${allData.family.state}, ${allData.family.country}`);
    doc.text(`Address: ${allData.family.address}`);
    doc.text(`Travel Radius: ${allData.family.travelRadiusMinutes} minutes`);
    doc.moveDown();
    
    // Children
    doc.fontSize(16).font("Helvetica-Bold").text("Children");
    doc.fontSize(12).font("Helvetica");
    allData.children.forEach((child, index) => {
      doc.text(`${index + 1}. ${child.name} (born ${child.birthdate})`);
      doc.fontSize(10).text(`   Interests: ${child.interests.join(", ")}`, { indent: 20 });
      if (child.learningStyle) {
        doc.text(`   Learning Style: ${child.learningStyle}`, { indent: 20 });
      }
      doc.moveDown(0.5);
    });
    doc.fontSize(12);
    doc.moveDown();
    
    // Curricula Summary
    doc.fontSize(16).font("Helvetica-Bold").text("Curriculum Overview");
    doc.fontSize(12).font("Helvetica");
    doc.text(`Total Curricula Generated: ${allData.curricula.length}`);
    if (allData.curricula.length > 0) {
      const activeCurriculum = allData.curricula.find(c => c.isActive);
      if (activeCurriculum) {
        doc.text(`Active Curriculum: Generated ${new Date(activeCurriculum.generatedAt!).toLocaleDateString()}`);
      }
    }
    doc.moveDown();
    
    // Journal Entries Summary
    doc.fontSize(16).font("Helvetica-Bold").text("Journal Entries");
    doc.fontSize(12).font("Helvetica");
    doc.text(`Total Journal Entries: ${allData.journalEntries.length}`);
    if (allData.journalEntries.length > 0) {
      const entriesWithPhotos = allData.journalEntries.filter(e => e.photoUrls && e.photoUrls.length > 0).length;
      const entriesWithAudio = allData.journalEntries.filter(e => e.audioUrl).length;
      doc.text(`Entries with Photos: ${entriesWithPhotos}`);
      doc.text(`Entries with Voice Notes: ${entriesWithAudio}`);
    }
    doc.moveDown();
    
    // Activity Feedback Summary
    doc.fontSize(16).font("Helvetica-Bold").text("Activity Feedback");
    doc.fontSize(12).font("Helvetica");
    doc.text(`Total Activity Feedback: ${allData.activityFeedback.length}`);
    doc.moveDown();
    
    // Emerging Interests
    doc.fontSize(16).font("Helvetica-Bold").text("Emerging Interests");
    doc.fontSize(12).font("Helvetica");
    doc.text(`Total Emerging Interest Signals: ${allData.emergingInterests.length}`);
    doc.moveDown();
    
    // Local Opportunities
    doc.fontSize(16).font("Helvetica-Bold").text("Local Opportunities");
    doc.fontSize(12).font("Helvetica");
    doc.text(`Total Local Opportunities: ${allData.localOpportunities.length}`);
    doc.moveDown();
    
    // Footer
    doc.fontSize(10).font("Helvetica").text(
      "This export contains all your family's data from Pollinate. All media files (photos, audio) are included in the ZIP archive.",
      { align: "center" }
    );
    
    doc.end();
    
    await new Promise<void>((resolve) => {
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(pdfBuffers);
        archive.append(pdfBuffer, { name: "family-summary.pdf" });
        resolve();
      });
    });

    // Download photos from object storage if they exist
    const objectStorage = new ObjectStorageService();
    for (const entry of allData.journalEntries) {
      if (entry.photoUrls && entry.photoUrls.length > 0) {
        for (let i = 0; i < entry.photoUrls.length; i++) {
          try {
            const photoUrl = entry.photoUrls[i];
            const fileName = photoUrl.split("/").pop() || `photo-${i}.jpg`;
            const photoStream = await objectStorage.getObject(photoUrl);
            archive.append(photoStream, { name: `photos/journal/${fileName}` });
          } catch (err) {
            console.error("Error downloading photo:", err);
          }
        }
      }
    }
    
    for (const feedback of allData.activityFeedback) {
      if (feedback.photoUrls && feedback.photoUrls.length > 0) {
        for (let i = 0; i < feedback.photoUrls.length; i++) {
          try {
            const photoUrl = feedback.photoUrls[i];
            const fileName = photoUrl.split("/").pop() || `photo-${i}.jpg`;
            const photoStream = await objectStorage.getObject(photoUrl);
            archive.append(photoStream, { name: `photos/activities/${fileName}` });
          } catch (err) {
            console.error("Error downloading photo:", err);
          }
        }
      }
    }

    await archive.finalize();
  } catch (error: any) {
    console.error("Export data error:", error);
    res.status(500).json({ error: error.message || "Failed to export data" });
  }
});

// Delete all photos and journal entries
router.delete("/api/family/photos-journals", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    // Delete from object storage first
    const journalEntries = await storage.getJournalEntries(family.id);
    const children = await storage.getChildren(family.id);
    const objectStorage = new ObjectStorageService();
    
    for (const entry of journalEntries) {
      if (entry.photoUrls && entry.photoUrls.length > 0) {
        for (const photoUrl of entry.photoUrls) {
          try {
            await objectStorage.deleteObject(photoUrl);
          } catch (err) {
            console.error("Error deleting photo from storage:", err);
          }
        }
      }
      
      if (entry.audioUrl) {
        try {
          await objectStorage.deleteObject(entry.audioUrl);
        } catch (err) {
          console.error("Error deleting audio from storage:", err);
        }
      }
    }
    
    for (const child of children) {
      const activityFeedback = await storage.getActivityFeedbackByChild(child.id);
      for (const feedback of activityFeedback) {
        if (feedback.photoUrls && feedback.photoUrls.length > 0) {
          for (const photoUrl of feedback.photoUrls) {
            try {
              await objectStorage.deleteObject(photoUrl);
            } catch (err) {
              console.error("Error deleting activity photo from storage:", err);
            }
          }
        }
      }
    }

    // Delete database records
    await storage.deleteAllPhotosAndJournals(family.id);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete photos and journals error:", error);
    res.status(500).json({ error: error.message || "Failed to delete photos and journals" });
  }
});

// Delete entire account and all data
router.delete("/api/family/account", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Delete from object storage first
    const allData = await storage.getAllFamilyData(req.user.id);
    const objectStorage = new ObjectStorageService();
    
    for (const entry of allData.journalEntries) {
      if (entry.photoUrls && entry.photoUrls.length > 0) {
        for (const photoUrl of entry.photoUrls) {
          try {
            await objectStorage.deleteObject(photoUrl);
          } catch (err) {
            console.error("Error deleting photo from storage:", err);
          }
        }
      }
      
      if (entry.audioUrl) {
        try {
          await objectStorage.deleteObject(entry.audioUrl);
        } catch (err) {
          console.error("Error deleting audio from storage:", err);
        }
      }
    }
    
    for (const feedback of allData.activityFeedback) {
      if (feedback.photoUrls && feedback.photoUrls.length > 0) {
        for (const photoUrl of feedback.photoUrls) {
          try {
            await objectStorage.deleteObject(photoUrl);
          } catch (err) {
            console.error("Error deleting activity photo from storage:", err);
          }
        }
      }
    }

    // Delete account (cascades to all family data via foreign keys)
    await storage.deleteAccount(req.user.id);

    // Clear session and redirect to home
    req.logout(() => {
      res.json({ success: true });
    });
  } catch (error: any) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: error.message || "Failed to delete account" });
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

// High School Mode - Get transcript courses for a child
router.get("/api/transcript/courses", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const childId = req.query.childId as string;
    if (!childId) {
      return res.status(400).json({ error: "Child ID is required" });
    }

    // Verify child belongs to user's family
    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const child = await storage.getChildById(childId);
    if (!child || child.familyId !== family.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const courses = await storage.getTranscriptCourses(childId);
    res.json(courses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// High School Mode - Create transcript course
router.post("/api/transcript/courses", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate request body
    const validationResult = insertTranscriptCourseSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: "Invalid course data", details: validationResult.error.errors });
    }

    const courseData = validationResult.data;

    // Verify child belongs to user's family
    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const child = await storage.getChildById(courseData.childId);
    if (!child || child.familyId !== family.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const course = await storage.createTranscriptCourse(courseData);
    res.json(course);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// High School Mode - Update transcript course
router.patch("/api/transcript/courses/:courseId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate request body (partial update)
    const validationResult = insertTranscriptCourseSchema.partial().safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: "Invalid course data", details: validationResult.error.errors });
    }

    const updateData = validationResult.data;
    const { courseId } = req.params;
    const course = await storage.getTranscriptCourse(courseId);
    
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Verify course belongs to user's family
    const child = await storage.getChildById(course.childId);
    const family = await storage.getFamily(req.user.id);
    
    if (!child || !family || child.familyId !== family.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updated = await storage.updateTranscriptCourse(courseId, updateData);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// High School Mode - Delete transcript course
router.delete("/api/transcript/courses/:courseId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { courseId } = req.params;
    const course = await storage.getTranscriptCourse(courseId);
    
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Verify course belongs to user's family
    const child = await storage.getChildById(course.childId);
    const family = await storage.getFamily(req.user.id);
    
    if (!child || !family || child.familyId !== family.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    await storage.deleteTranscriptCourse(courseId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// High School Mode - Download official transcript PDF
router.get("/api/transcript/download/:childId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { childId } = req.params;
    const child = await storage.getChildById(childId);
    
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }

    // Verify child belongs to user's family
    const family = await storage.getFamily(req.user.id);
    if (!family || child.familyId !== family.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get all courses for this child
    const courses = await storage.getTranscriptCourses(childId);
    
    if (courses.length === 0) {
      return res.status(404).json({ error: "No courses found for this student" });
    }

    // Create PDF
    const doc = new PDFDocument({ 
      size: 'LETTER',
      margins: { top: 72, bottom: 72, left: 72, right: 72 }
    });

    // Set response headers
    const childName = child.name.replace(/[^a-z0-9]/gi, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Official-Transcript-${childName}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Prepare transcript data
    const transcriptData = { child, family, courses };

    // Route to correct PDF generator based on education standard
    const standard = child.educationStandard || 'us';
    switch (standard) {
      case 'uk':
        generateUKTranscript(doc, transcriptData);
        break;
      case 'ib':
        generateIBTranscript(doc, transcriptData);
        break;
      case 'australia-nz':
        generateANZTranscript(doc, transcriptData);
        break;
      case 'eu':
        generateEUTranscript(doc, transcriptData);
        break;
      case 'classical':
        generateClassicalTranscript(doc, transcriptData);
        break;
      case 'us':
      case 'canada':
      case 'custom':
      default:
        // US/Canada/Custom use the same traditional transcript format
        generateUSTranscript(doc, transcriptData);
        break;
    }

    doc.end();
  } catch (error: any) {
    console.error("Transcript PDF generation error:", error);
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
    const familyApproach = await storage.getFamilyApproach(family.id);

    // Generate new curriculum
    const curriculumData = await generateCurriculum(family, children, opportunities, familyApproach?.approach);

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

// Download This Week - Generate beautiful printable PDF
router.get("/api/curriculum/download-week", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const weekNumber = parseInt(req.query.weekNumber as string) || 1;

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const curriculum = await storage.getActiveCurriculum(family.id);
    if (!curriculum) {
      return res.status(404).json({ error: "No active curriculum found" });
    }

    const week = curriculum.curriculumData.weeks.find((w: any) => w.weekNumber === weekNumber);
    if (!week) {
      return res.status(404).json({ error: "Week not found" });
    }

    const children = await storage.getChildren(family.id);
    
    // Fetch events for this week (14-day window)
    const startDate = parseISO(curriculum.curriculumData.generatedAt);
    const weekStart = addDays(startDate, (weekNumber - 1) * 7);
    const weekEnd = addDays(startDate, (weekNumber - 1) * 7 + 6);
    const events = await storage.getUpcomingEventsForWeek(family.id, weekStart, weekEnd);

    // Create PDF
    const doc = new PDFDocument({ 
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Week-${weekNumber}-Pollinate.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Sage green color
    const sageGreen = '#8A9A5B';
    const lightSage = '#E8EDE0';

    // === COVER PAGE ===
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(lightSage);
    
    // Decorative border
    doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
       .lineWidth(3)
       .stroke(sageGreen);

    // Title
    doc.fillColor(sageGreen)
       .fontSize(42)
       .font('Helvetica-Bold')
       .text('Pollinate', 70, 150, { align: 'center' });

    doc.fillColor('#333333')
       .fontSize(24)
       .font('Helvetica')
       .text(`Week ${weekNumber}`, 70, 210, { align: 'center' });

    doc.fontSize(28)
       .font('Helvetica-Bold')
       .text(week.familyTheme || 'Learning Adventure', 70, 260, { align: 'center' });

    // Family name
    doc.fontSize(14)
       .font('Helvetica')
       .fillColor('#666666')
       .text(family.familyName, 70, 340, { align: 'center' });

    // Date range
    doc.fontSize(12)
       .text(`${formatDate(weekStart, 'MMM d')} – ${formatDate(weekEnd, 'MMM d, yyyy')}`, 70, 365, { align: 'center' });

    // Friendly note at bottom
    doc.fontSize(11)
       .fillColor(sageGreen)
       .font('Helvetica-Oblique')
       .text('✨ Print or use on tablet — works offline all week ✨', 70, doc.page.height - 120, { 
         align: 'center',
         width: doc.page.width - 140
       });

    // === DAILY PLANS PAGE ===
    doc.addPage();
    
    let yPos = 60;
    
    // Page header
    doc.rect(0, 0, doc.page.width, 40).fill(sageGreen);
    doc.fillColor('white')
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('This Week\'s Learning Plan', 50, 12);

    yPos = 70;

    // Loop through each child's activities
    for (const child of children) {
      const childActivities = week.childPlans?.find((p: any) => p.childName === child.name);
      if (!childActivities) continue;

      // Child name header
      if (yPos > 700) {
        doc.addPage();
        yPos = 60;
      }

      doc.fillColor(sageGreen)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text(child.name, 50, yPos);
      
      yPos += 30;

      // Daily activities
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
        const dayActivities = childActivities.dailyActivities?.[dayIdx];
        if (!dayActivities) continue;

        if (yPos > 650) {
          doc.addPage();
          yPos = 60;
        }

        // Day header with border
        doc.rect(50, yPos, doc.page.width - 100, 25)
           .fillAndStroke(lightSage, sageGreen);
        
        doc.fillColor('#333333')
           .fontSize(12)
           .font('Helvetica-Bold')
           .text(days[dayIdx], 60, yPos + 7);

        yPos += 35;

        // Main activity
        if (dayActivities.mainActivity) {
          doc.fillColor('#333333')
             .fontSize(11)
             .font('Helvetica-Bold')
             .text(dayActivities.mainActivity.title || 'Main Activity', 60, yPos);
          
          yPos += 18;

          if (dayActivities.mainActivity.description) {
            doc.fontSize(10)
               .font('Helvetica')
               .text(dayActivities.mainActivity.description, 60, yPos, { 
                 width: doc.page.width - 120,
                 align: 'left'
               });
            yPos += doc.heightOfString(dayActivities.mainActivity.description, { width: doc.page.width - 120 }) + 10;
          }

          // Confidence-boosting examples
          if (dayActivities.mainActivity.examples && dayActivities.mainActivity.examples.length > 0) {
            doc.fillColor(sageGreen)
               .fontSize(9)
               .font('Helvetica-Bold')
               .text('Quick Ideas:', 60, yPos);
            yPos += 15;

            for (const example of dayActivities.mainActivity.examples.slice(0, 3)) {
              if (yPos > 700) {
                doc.addPage();
                yPos = 60;
              }

              doc.fillColor('#666666')
                 .fontSize(8)
                 .font('Helvetica-Bold')
                 .text(`• ${example.difficulty}:`, 70, yPos);
              
              yPos += 12;

              doc.fillColor('#333333')
                 .fontSize(8)
                 .font('Helvetica')
                 .text(example.description, 80, yPos, { width: doc.page.width - 140 });
              
              yPos += doc.heightOfString(example.description, { width: doc.page.width - 140 }) + 8;
            }
          }
        }

        yPos += 10;
      }

      yPos += 15;
    }

    // === MATERIALS & SHOPPING LIST PAGE ===
    doc.addPage();
    
    doc.rect(0, 0, doc.page.width, 40).fill(sageGreen);
    doc.fillColor('white')
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('Materials & Shopping List', 50, 12);

    yPos = 70;

    if (week.resources && week.resources.length > 0) {
      // Group by category
      const freeResources = week.resources.filter((r: any) => 
        r.cost === 'Free' || r.category === 'household-items' || r.category === 'nature-materials'
      );
      const lowCostResources = week.resources.filter((r: any) => 
        r.cost === 'Low Cost' && r.category !== 'household-items' && r.category !== 'nature-materials'
      );
      const otherResources = week.resources.filter((r: any) => 
        r.cost !== 'Free' && r.cost !== 'Low Cost' && r.category !== 'household-items' && r.category !== 'nature-materials'
      );

      // Free & Recycled (highlighted)
      if (freeResources.length > 0) {
        doc.rect(50, yPos, doc.page.width - 100, 30)
           .fillAndStroke('#E8F5E9', '#4CAF50');
        
        doc.fillColor('#2E7D32')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('🌿 Free & Around the House', 60, yPos + 8);
        
        yPos += 40;

        for (const resource of freeResources) {
          if (yPos > 720) {
            doc.addPage();
            yPos = 60;
          }

          doc.fillColor('#333333')
             .fontSize(10)
             .font('Helvetica')
             .text(`• ${resource.title}${resource.description ? ' - ' + resource.description : ''}`, 60, yPos, {
               width: doc.page.width - 120
             });
          yPos += doc.heightOfString(`• ${resource.title}${resource.description ? ' - ' + resource.description : ''}`, { width: doc.page.width - 120 }) + 8;
        }

        yPos += 15;
      }

      // Low Cost
      if (lowCostResources.length > 0) {
        doc.fillColor(sageGreen)
           .fontSize(13)
           .font('Helvetica-Bold')
           .text('💰 Low Cost', 50, yPos);
        
        yPos += 25;

        for (const resource of lowCostResources) {
          if (yPos > 720) {
            doc.addPage();
            yPos = 60;
          }

          doc.fillColor('#333333')
             .fontSize(10)
             .font('Helvetica')
             .text(`• ${resource.title}${resource.description ? ' - ' + resource.description : ''}`, 60, yPos, {
               width: doc.page.width - 120
             });
          yPos += doc.heightOfString(`• ${resource.title}${resource.description ? ' - ' + resource.description : ''}`, { width: doc.page.width - 120 }) + 8;
        }
      }
    } else {
      doc.fillColor('#666666')
         .fontSize(11)
         .font('Helvetica-Oblique')
         .text('No specific materials needed this week — use what you have at home!', 60, yPos);
    }

    // === LOCAL HAPPENINGS PAGE ===
    if (events && events.length > 0) {
      doc.addPage();
      
      doc.rect(0, 0, doc.page.width, 40).fill(sageGreen);
      doc.fillColor('white')
         .fontSize(18)
         .font('Helvetica-Bold')
         .text('Local Happenings This Week', 50, 12);

      yPos = 70;

      for (const event of events.slice(0, 10)) {
        if (yPos > 680) {
          doc.addPage();
          yPos = 60;
        }

        // Event box
        doc.rect(50, yPos, doc.page.width - 100, 'auto')
           .lineWidth(1)
           .stroke(sageGreen);

        // Event name
        doc.fillColor('#333333')
           .fontSize(12)
           .font('Helvetica-Bold')
           .text(event.name, 60, yPos + 10, { width: doc.page.width - 120 });
        
        let eventY = yPos + 10 + doc.heightOfString(event.name, { width: doc.page.width - 120 }) + 5;

        // Date & time
        if (event.startDate) {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor('#666666')
             .text(`📅 ${formatDate(parseISO(event.startDate), 'EEE, MMM d')}${event.startTime ? ' at ' + event.startTime : ''}`, 60, eventY);
          eventY += 15;
        }

        // Location
        if (event.location) {
          doc.text(`📍 ${event.location}`, 60, eventY, { width: doc.page.width - 120 });
          eventY += doc.heightOfString(event.location, { width: doc.page.width - 120 }) + 5;
        }

        // Why it fits
        if (event.whyItFits) {
          doc.fillColor(sageGreen)
             .fontSize(8)
             .font('Helvetica-Oblique')
             .text(`💡 ${event.whyItFits}`, 60, eventY, { width: doc.page.width - 120 });
          eventY += doc.heightOfString(event.whyItFits, { width: doc.page.width - 120 }) + 5;
        }

        yPos = eventY + 20;
      }
    }

    // === JOURNAL PAGES (3 pages) ===
    for (let i = 0; i < 3; i++) {
      doc.addPage();
      
      doc.rect(0, 0, doc.page.width, 40).fill(lightSage);
      doc.fillColor(sageGreen)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('Journal & Reflections', 50, 12);

      // Date line
      doc.fillColor('#666666')
         .fontSize(10)
         .font('Helvetica')
         .text('Date: ______________________    Child: ______________________', 50, 60);

      // Ruled lines for writing
      yPos = 100;
      while (yPos < doc.page.height - 150) {
        doc.moveTo(50, yPos)
           .lineTo(doc.page.width - 50, yPos)
           .stroke('#CCCCCC');
        yPos += 20;
      }

      // Drawing/sketch box at bottom
      doc.rect(50, doc.page.height - 130, doc.page.width - 100, 80)
         .lineWidth(1)
         .stroke(sageGreen);
      
      doc.fillColor('#999999')
         .fontSize(9)
         .font('Helvetica-Oblique')
         .text('Sketch or doodle space', 60, doc.page.height - 120);
    }

    // === NARRATION PROMPTS PAGE ===
    doc.addPage();
    
    doc.rect(0, 0, doc.page.width, 40).fill(sageGreen);
    doc.fillColor('white')
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('Narration & Discussion Prompts', 50, 12);

    yPos = 70;

    const narrationPrompts = [
      "Tell me about something interesting you learned today...",
      "What was your favourite part of this activity?",
      "If you could teach someone else about this, what would you say?",
      "What questions do you still have?",
      "How does this connect to something you already know?",
      "What would you like to explore more deeply?",
      "Describe what you made/discovered in your own words...",
      "What surprised you today?"
    ];

    for (const prompt of narrationPrompts) {
      if (yPos > 700) {
        doc.addPage();
        yPos = 60;
      }

      doc.fillColor(sageGreen)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('❓', 50, yPos);

      doc.fillColor('#333333')
         .fontSize(11)
         .font('Helvetica')
         .text(prompt, 70, yPos, { width: doc.page.width - 120 });
      
      yPos += 25;

      // Lines for response
      for (let i = 0; i < 3; i++) {
        doc.moveTo(70, yPos)
           .lineTo(doc.page.width - 50, yPos)
           .stroke('#DDDDDD');
        yPos += 18;
      }

      yPos += 10;
    }

    // Finalize PDF
    doc.end();

  } catch (error: any) {
    console.error("PDF generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate PDF" });
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

    const { transcript, childId, duration, audioUrl } = req.body;
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: "Transcript or summary is required" });
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

    // Generate AI follow-up questions to deepen reflection
    const followUpPrompt = `Based on this learning journal entry, generate 2-3 thoughtful follow-up questions that would help the mum reflect more deeply and provide additional context. The questions should be warm, encouraging, and help uncover more details about the child's learning experience.

Journal summary: ${analysis.summary}
Interests detected: ${analysis.interests?.join(', ') || 'None'}
Skills shown: ${analysis.skills?.join(', ') || 'None'}

Generate questions that are:
- Warm and conversational (addressing "you" as the mum)
- Specific to the content mentioned
- Designed to reveal more about the child's engagement, understanding, or next steps
- Helpful for future curriculum planning

Respond with ONLY a JSON array of 2-3 question strings, like: ["Question 1?", "Question 2?", "Question 3?"]`;

    const questionsCompletion = await openai.chat.completions.create({
      model: "anthropic/claude-3.5-sonnet",
      messages: [{ role: "user", content: followUpPrompt }],
      temperature: 0.7,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    let followUpQuestions: string[] = [];
    try {
      const questionsResponse = JSON.parse(questionsCompletion.choices[0].message.content || '{"questions":[]}');
      followUpQuestions = questionsResponse.questions || questionsResponse;
      // Ensure it's an array
      if (!Array.isArray(followUpQuestions)) {
        followUpQuestions = Object.values(questionsResponse).filter((v): v is string => typeof v === 'string');
      }
    } catch (e) {
      console.error('Failed to parse follow-up questions:', e);
      followUpQuestions = [
        "What seemed to spark the most excitement or curiosity?",
        "Were there any moments of struggle or breakthrough?",
      ];
    }

    const entry = await storage.createJournalEntry({
      childId: targetChildId,
      familyId: family.id,
      entryDate: new Date().toISOString().split('T')[0],
      content: transcript,
      photoUrls: [],
      audioUrl: audioUrl || null,
      audioDuration: duration || null,
      aiFollowUpQuestions: followUpQuestions,
      aiAnalysis: analysis,
    });

    res.json({ 
      entry, 
      analysis,
      followUpQuestions,
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

// Save follow-up question answers
router.patch("/api/journal/:entryId/follow-up-answers", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const family = await storage.getFamily(req.user.id);
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }

    const { entryId } = req.params;
    const { answers } = req.body;

    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: "Answers must be an array" });
    }

    await storage.updateJournalEntryFollowUpAnswers(entryId, answers);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error saving follow-up answers:', error);
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
