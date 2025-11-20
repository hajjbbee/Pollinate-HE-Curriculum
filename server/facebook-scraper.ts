import { InsertUpcomingEvent } from "@shared/schema";
import * as cheerio from "cheerio";

/**
 * Extract Facebook group ID from URL
 * Supports formats:
 * - https://www.facebook.com/groups/123456789
 * - https://www.facebook.com/groups/groupname/
 * - facebook.com/groups/groupname
 */
export function extractFacebookGroupId(url: string): string | null {
  try {
    // Remove protocol and www if present
    const cleanUrl = url.replace(/^(https?:\/\/)?(www\.)?/, '');
    
    // Match various Facebook group URL patterns
    const patterns = [
      /facebook\.com\/groups\/(\d+)/i,
      /facebook\.com\/groups\/([^\/\?]+)/i,
      /groups\/(\d+)/i,
      /groups\/([^\/\?]+)/i,
    ];

    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting Facebook group ID:', error);
    return null;
  }
}

/**
 * Scrape Facebook group events using mobile endpoint
 * This uses the public m.basic.facebook.com endpoint which often works
 * for public groups and groups the user is in
 */
export async function scrapeFacebookGroupEvents(
  groupId: string,
  groupName: string
): Promise<Partial<InsertUpcomingEvent>[]> {
  try {
    const url = `https://m.basic.facebook.com/groups/${groupId}/?view=events`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.error(`Facebook scrape failed with status ${response.status}`);
      return [];
    }

    const html = await response.text();
    
    // Check if the content indicates a private group
    if (html.includes('This group is private') || html.includes('Join Group') || html.includes('Request to Join')) {
      console.log(`⚠️ Group ${groupId} (${groupName}) appears to be private or requires membership`);
      return [];
    }

    // Parse events from HTML using cheerio
    const $ = cheerio.load(html);
    const events: Partial<InsertUpcomingEvent>[] = [];

    // Facebook mobile events are typically in a simple list format
    // Look for event links and extract data
    $('a[href*="/events/"]').each((i, element) => {
      try {
        const $link = $(element);
        const href = $link.attr('href');
        const text = $link.text().trim();
        
        if (!href || !text) return;

        // Extract event ID from URL
        const eventIdMatch = href.match(/\/events\/(\d+)/);
        if (!eventIdMatch) return;

        const eventId = eventIdMatch[1];
        const eventUrl = `https://www.facebook.com/events/${eventId}`;

        // Look for date/time information nearby
        let eventDate = new Date();
        eventDate.setDate(eventDate.getDate() + 7); // Default to next week

        const dateText = $link.parent().text() || $link.next().text();
        const dateMatch = dateText.match(/(\w+ \d+)|(\d+:\d+ [AP]M)/);
        
        if (dateMatch) {
          try {
            const parsedDate = new Date(dateMatch[0]);
            if (!isNaN(parsedDate.getTime())) {
              eventDate = parsedDate;
            }
          } catch (e) {
            // Use default date
          }
        }

        events.push({
          eventName: text,
          eventDate,
          location: 'See Facebook for details',
          cost: 'Varies',
          category: 'homeschool',
          description: `Event from ${groupName} Facebook group`,
          ticketUrl: eventUrl,
          source: 'facebook_group',
          externalId: eventId,
          groupId,
          groupName,
        });
      } catch (error) {
        // Skip this event and continue
      }
    });

    // Limit to 10 events per group
    console.log(`✅ Scraped ${events.length} events from ${groupName}`);
    return events.slice(0, 10);
  } catch (error) {
    console.error(`Error scraping Facebook group ${groupId}:`, error);
    return [];
  }
}

/**
 * Fetch events from all connected Facebook groups for a family
 */
export async function fetchAllFacebookGroupEvents(
  groups: Array<{ groupId: string; groupName: string }>
): Promise<Partial<InsertUpcomingEvent>[]> {
  if (groups.length === 0) {
    return [];
  }

  console.log(`🔍 Fetching events from ${groups.length} Facebook groups...`);

  // Fetch events from all groups in parallel
  const eventPromises = groups.map(group => 
    scrapeFacebookGroupEvents(group.groupId, group.groupName)
  );

  const results = await Promise.all(eventPromises);
  
  // Flatten and deduplicate
  const allEvents = results.flat();
  
  // Remove duplicates by event ID
  const seen = new Set<string>();
  const uniqueEvents = allEvents.filter(event => {
    if (!event.externalId) return true;
    if (seen.has(event.externalId)) return false;
    seen.add(event.externalId);
    return true;
  });

  console.log(`✅ Total ${uniqueEvents.length} unique events from Facebook groups`);
  return uniqueEvents;
}
