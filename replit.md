# Pollinate - Home Education Curriculum

## Overview
Pollinate is a home education curriculum SaaS platform designed for multi-child families. It generates personalized, AI-powered 12-week rolling curricula by blending Charlotte Mason, Montessori, unschooling, and project-based learning methodologies. The platform tailors educational plans to each child's interests and learning style, integrating local educational opportunities. It serves families in the United States, Australia, and New Zealand, adapting to regional differences and measurement systems. The project aims to provide an accessible and adaptable home education solution with a focus on personalized learning and community integration.

## User Preferences
Preferred communication style: Simple, everyday language.
Language: Australian English (use "mum" not "mom", "colour" not "color", etc.)

## System Architecture

### Frontend Architecture
The frontend is built with React and TypeScript, using Vite for bundling. It leverages Shadcn/UI components (based on Radix UI) and Tailwind CSS for a responsive, mobile-first design with a golden yellow color palette. Wouter handles routing, while TanStack Query manages server state and React Hook Form with Zod is used for form validation. Key features include a multi-step onboarding process, a dashboard with an accordion-based weekly curriculum view, a journal entry system with rich text editing (TipTap), interactive Google Maps integration for local opportunities, and photo uploads via Uppy. Real-time collaboration is supported via WebSockets, providing live presence indicators and instant curriculum updates.

### Backend Architecture
The backend uses Node.js with Express and implements RESTful API endpoints. Authentication is handled via Replit Auth with OpenID Connect, utilizing `express-session` and a PostgreSQL session store. Drizzle ORM provides type-safe database interactions with PostgreSQL (Neon serverless). Core data models include Users, Families, Children, Curricula, Journal Entries, Local Opportunities, Upcoming Events, and Homeschool Groups. AI integration is powered by the Anthropic Claude API for curriculum generation, focusing on hybrid educational methodologies, depth-over-breadth, multi-child coordination, and location-aware suggestions. Google Maps Geocoding and Places APIs are used for address validation, coordinate conversion, and discovering local educational opportunities.

### Data Storage Solutions
PostgreSQL (Neon serverless) is the primary database, managed by Drizzle ORM. Object storage for photos and assets uses Google Cloud Storage via the Replit Object Storage sidecar, supporting custom ACLs and pre-signed URLs. Session storage is also handled by PostgreSQL.

### Authentication and Authorization
Authentication is through Replit Auth (OIDC), providing SSO and managing user profiles. Authorization follows a family ownership model, where users can only access their own family's data. Security measures include HTTPS-only cookies, environment-variable-based session secrets, CSRF protection, and Zod schema validation for input.

### UI/UX Decisions
The platform features a comprehensive settings page for family details, children management, and curriculum regeneration. The dashboard displays all 12 weeks of the curriculum in a vertical accordion layout, with week preview cards showing themes, badges, and progress rings. A sticky desktop calendar sidebar and a mobile week selector enhance navigation. A golden yellow color scheme (HSL 45°) is used throughout, replacing a previous forest green palette, and typography uses Inter and Lexend fonts. The platform includes a resource list with free, low-cost, and recycled/household items, and an upcoming events feature with smart caching and theme matching.

### Technical Implementations
Smart children management ensures data integrity during updates. Automatic curriculum regeneration is triggered by settings changes, including clearing local opportunities and fetching new ones. Production-ready error handling is implemented across frontend and backend, with specific user feedback for issues like credit exhaustion or API failures. API optimizations reduce token usage for AI services. Real-time events are cached and displayed for a 14-day window from multiple sources, including manual Facebook group event integration.

## External Dependencies

### AI Services
- **Anthropic Claude API**: For AI-powered curriculum generation (via OpenRouter proxy).

### Google Cloud Services
- **Google Maps Geocoding API**: For address validation and coordinate conversion.
- **Google Places API**: For discovering local educational opportunities.
- **Google Cloud Storage**: For photo and asset storage (integrated via Replit Object Storage).

### Replit Platform Services
- **Replit Auth**: For user authentication and identity management.
- **Replit Object Storage**: GCS-compatible storage solution.

### Other Third-Party Integrations
- **Stripe**: For subscription billing (Stripe Checkout and webhooks).
- **Eventbrite API**: For real-time local event discovery.

### Deferred Integrations
- **Email (Resend/SendGrid)**: Weekly summary emails are planned but integration was dismissed during initial setup. Will need to configure Resend connector or manually add API keys as secrets for future email functionality (Sunday night summaries with mastery stats, photos, and next week preview).