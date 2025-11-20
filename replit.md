# Evergreen Curriculum AI

## Overview

Evergreen Curriculum AI is a homeschool curriculum SaaS platform that generates personalized, AI-powered 12-week rolling curricula for multi-child families. The platform combines Charlotte Mason, Montessori, unschooling, and project-based learning methodologies to create interest-led educational plans tailored to each child's unique learning profile and local educational opportunities.

The application serves families in the United States, Australia, and New Zealand, integrating location-based learning opportunities and adapting to regional differences in measurement systems and geographical contexts.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**November 20, 2025** - OpenRouter Integration for Free Tier Testing
- **Switched to OpenRouter**: Replaced direct Anthropic SDK with OpenRouter proxy
  - Model: `anthropic/claude-3.5-sonnet` via OpenRouter API
  - Free tier credits enable testing without billing setup
  - Token limit: 2500 (fits within free tier ~2666 token budget)
  - Generates condensed but complete 12-week curricula
- **Manual Address Entry**: Onboarding now accepts typed addresses when Google Places autocomplete fails
  - `lat` and `lng` optional in frontend validation
  - Backend geocodes all addresses via Google Maps Geocoding API
- **Improved Error Handling**: Graceful fallback when AI generation fails due to credits/billing

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
- Nature-inspired green color palette (forest green #2D5F3F as primary)
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