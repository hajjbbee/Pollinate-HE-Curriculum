# Pollinate - Home Education Curriculum

## Overview

Pollinate is a home education curriculum SaaS platform that generates personalized, AI-powered 12-week rolling curricula for multi-child families. The platform combines Charlotte Mason, Montessori, unschooling, and project-based learning methodologies to create interest-led educational plans tailored to each child's unique learning profile and local educational opportunities.

The application serves families in the United States, Australia, and New Zealand, integrating location-based learning opportunities and adapting to regional differences in measurement systems and geographical contexts.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**November 20, 2025** - Dashboard Redesign & Production-Ready Enhancements

- **Dashboard Redesign - All 12 Weeks View** (COMPLETE)
  - **Vertical Accordion Layout**: Shows all 12 weeks simultaneously instead of single-week navigation
  - **Week Preview Cards**: Collapsed state shows theme, date range, 2-3 activity/resource badges, progress ring, and "Regenerate" button
  - **Desktop Calendar Sidebar**: 280px sticky sidebar with all weeks listed, current week highlighted in green
  - **Mobile Week Selector**: Horizontal scrollable week selector for responsive design
  - **Progress Rings**: SVG circle indicators showing journal entry completion (X/5 days) per week
  - **Smart Current Week Calculation**: Derives current week from today's date vs curriculum.generatedAt
    - Handles edge cases: future curriculum start (defaults to week 1), past 12 weeks (defaults to week 12)
    - Re-calculates when curriculum is regenerated
  - **Accurate Progress Binning**: Uses exact date range comparison for journal entries instead of buggy isSameWeek
  - **Lazy Rendering Performance**: Only mounts heavy content (children plans, opportunities, resources) for expanded weeks
    - Tracks expandedWeeks in Set<number> state
    - Dramatically improves initial render time on mobile devices
  - **Critical Bug Fix**: Fixed upsertUser foreign key constraint violations by excluding 'id' from updates and using email for conflict resolution

**November 20, 2025** - Real-Time Events & Homeschool Groups
- **My Homeschool Groups Feature**: Manual Facebook group event integration (COMPLETE)
  - **Settings Management**: Add/remove Facebook groups by URL and name
  - **Manual Event Entry**: Collapsible forms to add events from each group
  - **Dashboard Integration**: "From Your Groups" section with Facebook icon branding
  - **Event Separation**: Local API events vs. manually-entered group events displayed separately
  - **Data Model**: `homeschoolGroups` table with group URL, name, and sync status
  - **Event Linkage**: Events tagged with `groupId` and `groupName` for attribution
  - **MVP Approach**: Manual entry avoids Facebook ToS violations and technical fragility
  - **Future Consideration**: Explore compliant solutions (Graph API, browser extension) for Pro tier

- **Resource List Feature**: Curated learning resources for each week (COMPLETE)
  - 9-12 resources per week across three categories: FREE, LOW-COST (<$15), RECYCLED/HOUSEHOLD
  - FREE resources: YouTube, Khan Academy, BBC Bitesize, Librivox, library books, printables
  - LOW-COST: Thriftbooks, BookOutlet, Etsy printables, TeachersPayTeachers under $5
  - RECYCLED/HOUSEHOLD: DIY projects using cardboard, bottles, leaves, kitchen items
  - Beautiful accordion UI with category icons (Gift for free, DollarSign for low-cost, Leaf for recycled)
  - "Copy to Shopping List" button with clipboard functionality and toast feedback
  - Resources optimized to fit within OpenRouter free tier token limits (max_tokens: 1600)
  - Prioritizes recycled/household items as key selling point for budget-conscious families
  
- **Upcoming Events Feature**: Real-time local educational events with smart caching
  - **6-Hour Smart Caching**: Events cached for 6 hours, then automatically refreshed
  - **14-Day Window**: Always shows events happening in the next 14 days (never stale past events)
  - Multi-source event discovery: Eventbrite API and Google Places
  - Theme matching: Events matched to curriculum week themes
  - Event details: name, date/time, location, drive time, cost (highlighting FREE), age range, and "why it fits"
  - Beautiful UI with golden yellow calendar icons and subtle backgrounds
  - Individual event cards with icon backgrounds (primary/10 opacity)
  - Database table: `upcoming_events` with `cachedAt` timestamps
  - API endpoint: `/api/events/week/:weekNumber` fetches next 14 days regardless of week viewed
  
- **Rebranding**: Complete rebrand from "Evergreen" to "Pollinate - Home Education Curriculum"
  - Golden yellow color scheme (HSL 45°) replacing forest green throughout
  - Updated tagline, headers, sidebar, landing page, and all user-facing text
  - Design guidelines updated with new color palette
  - "Start Onboarding" button added to empty dashboard state
  
- **OpenRouter Integration**: Replaced direct Anthropic SDK with OpenRouter proxy
  - Model: `anthropic/claude-3.5-sonnet` via OpenRouter API
  - Free tier credits enable testing without billing setup
  - Token limit: 2000 (optimized for free tier credit management)
  - Generates condensed but complete 12-week curricula
  
- **Production-Ready Error Handling**:
  - API key validation at startup (OPENROUTER_API_KEY, GOOGLE_MAPS_API_KEY, EVENTBRITE_API_KEY optional)
  - Timeout protection: 10s for geocoding, 8s for Places API
  - Retry logic: 2 attempts with exponential backoff for geocoding
  - Specific error messages for billing (402), auth (401), and quota issues
  
- **Manual Address Entry**: Onboarding accepts typed addresses when Google Places autocomplete fails
  - `lat` and `lng` optional in frontend validation
  - Backend geocodes all addresses via Google Maps Geocoding API
  
- **Improved Onboarding UX**: Added step navigation dropdown menu
  - Clear step labels: "Family", "Location", "Learners"
  - Visual icons for each step (Users, MapPin, Calendar)
  - Shows completion status with checkmarks
  - Makes the "Learners" tab more obvious for adding children

**November 19, 2025** - Stripe Subscription Billing & Enhanced Local Opportunities
- **Stripe Subscription Billing (COMPLETE)**:
  - Two-tier pricing: Basic ($49/month, up to 3 children) and Pro ($99/month, unlimited)
  - Secure checkout with Stripe Checkout integration
  - Webhook handling with HMAC signature verification (checkout.session.completed, customer.subscription.updated/deleted)
  - Customer portal for subscription management
  - Dashboard subscription status badges and upgrade buttons
  - Proper IStorage interface with Stripe ID lookup methods
  
- **Enhanced Google Places API Integration**:
  - Expanded keyword search from 5 to 20 educational venue types
  - Improved deduplication using place_id tracking
  - Increased diversity: up to 25 unique opportunities per family (up from 15)
  - Fixed radius calculation: properly converts travel time (minutes) to search distance (meters)
  - Better error handling and logging for API responses
  - Search includes: museums, libraries, science centers, historical sites, nature centers, art galleries, maker spaces, farms, botanical gardens, aquariums, zoos, planetariums, observatories, wildlife sanctuaries, and community gardens
  
- **Real-Time Collaboration (WebSockets)**:
  - WebSocket server for multi-user real-time collaboration
  - Session-based authentication with family access control
  - Live presence indicators showing active users viewing curriculum
  - Real-time curriculum update broadcasts after regeneration
  - Heartbeat ping/pong for stale connection cleanup
  - Auto-reconnection with proper cleanup on disconnect

## System Architecture

### Real-Time Collaboration

**WebSocket Server** (`server/websocket.ts`):
- Path: `/ws` with session-based authentication
- Validates session cookies during connection upgrade
- Family-level access control (users can only join their own family)
- Presence tracking: Shows which users are viewing which weeks
- Broadcast system: Notifies family members of curriculum updates
- Heartbeat: 30-second ping/pong to detect stale connections
- Auto-cleanup: Removes disconnected clients and clears intervals

**Frontend Integration** (`client/src/hooks/use-collaboration.ts`):
- Custom React hook managing WebSocket lifecycle
- Auto-connect when user and family data available
- Presence broadcasting when switching weeks
- Event listeners for real-time curriculum updates
- Auto-reconnection after 3 seconds on disconnect
- Proper cleanup to prevent memory leaks

**Dashboard Features**:
- Live presence indicators with user avatars
- Green pulsing dot showing connection status
- Tooltip displaying active users and their current weeks
- Real-time notifications when other users update curriculum

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Component System**: 
- Shadcn/UI components built on Radix UI primitives
- Tailwind CSS for styling with custom design system
- Golden yellow color palette (warm yellow #D4A843 as primary)
- Typography: Inter for body text, Lexend for headings
- Responsive design with mobile-first approach

**Routing**: Wouter for lightweight client-side routing

**State Management**: 
- TanStack Query (React Query) for server state
- React Hook Form with Zod for form validation
- Local component state with React hooks

**Key Frontend Features**:
- Multi-step onboarding flow with address autocomplete
- Dashboard with weekly curriculum view and accordion-based week navigation
- Journal entry system with rich text editing (TipTap)
- Interactive Google Maps integration for local opportunities
- Photo upload functionality using Uppy

### Backend Architecture

**Runtime**: Node.js with Express server

**API Design**: RESTful API endpoints under `/api` namespace

**Authentication**: Replit Auth with OpenID Connect (OIDC)
- Session-based authentication using express-session
- PostgreSQL session store for persistence
- Passport.js strategy for OIDC integration

**Database ORM**: Drizzle ORM with type-safe schema definitions

**Core Data Models**:
- Users (Replit Auth integration)
- Families (primary organizational unit, one per user)
- Children (multiple per family, with birthdate, interests, learning styles)
- Curricula (12-week rolling plans with JSON data structure)
- Journal Entries (daily logs per child with rich text and photos)
- Local Opportunities (geocoded educational venues and activities)
- Upcoming Events (real-time events from Eventbrite, Meetup, Google Places with theme matching, plus manually-entered Facebook group events)
- Homeschool Groups (Facebook groups for manual event discovery and entry)

**AI Integration**: Anthropic Claude API for curriculum generation
- System prompt enforces hybrid educational methodology
- Depth-over-breadth philosophy with mastery level tracking
- Family-style multi-child coordination
- Location-aware opportunity suggestions

**Geocoding & Maps**: 
- Google Maps Geocoding API for address to coordinates conversion
- Google Places API for discovering local educational opportunities
- Distance calculations based on travel radius preferences

### Data Storage Solutions

**Primary Database**: PostgreSQL via Neon serverless
- Drizzle ORM for type-safe queries and migrations
- Connection pooling with @neondatabase/serverless
- Schema-first approach with shared TypeScript types

**Object Storage**: Google Cloud Storage via Replit Object Storage sidecar
- Photo uploads for journal entries
- Custom ACL (Access Control List) system for object-level permissions
- Pre-signed URLs for secure uploads
- Uppy integration for client-side upload handling

**Session Storage**: PostgreSQL table-based sessions
- connect-pg-simple for Express session store
- 7-day session TTL (time to live)

### Authentication and Authorization

**Primary Auth**: Replit Authentication
- OIDC-based SSO (Single Sign-On)
- User profile management (email, first name, last name, profile image)
- Session management with secure HTTP-only cookies
- Automatic user upsert on authentication

**Authorization Model**:
- User-to-family one-to-one relationship
- Family ownership model: users can only access their own family data
- Child-level access through family ownership
- Object storage ACL for photo access control

**Security Measures**:
- HTTPS-only cookies in production
- Session secret from environment variables
- CSRF protection through session-based auth
- Input validation with Zod schemas

### External Dependencies

**AI Services**:
- Anthropic Claude API (configurable model via environment variable)
- Used for curriculum generation with structured JSON output
- Supports depth exploration based on child interest signals

**Google Cloud Services**:
- Google Maps Geocoding API: Address validation and coordinate conversion
- Google Places API: Discovery of educational venues (museums, libraries, parks, etc.)
- Google Cloud Storage: Photo and asset storage via Replit integration

**Replit Platform Services**:
- Replit Auth: User authentication and identity management
- Replit Object Storage: GCS-compatible storage with sidecar proxy
- Development tools: Cartographer and dev banner plugins

**Third-Party Libraries**:
- TipTap: Rich text editing for journal entries
- Uppy: File upload with AWS S3-compatible interface
- Wouter: Lightweight routing
- TanStack Query: Server state management
- Radix UI: Accessible component primitives
- DOMPurify: XSS protection for rich text content

**Environment Configuration**:
- DATABASE_URL: PostgreSQL connection string (Neon)
- ANTHROPIC_API_KEY: Claude API authentication
- GOOGLE_MAPS_API_KEY: Geocoding and Places API access
- SESSION_SECRET: Session encryption key
- ISSUER_URL: Replit OIDC provider URL
- REPL_ID: Replit deployment identifier