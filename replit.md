# Pollinate - Home Education Curriculum

## Overview
Pollinate is a SaaS platform providing AI-powered, personalized 12-week rolling curricula for multi-child home education families globally. It integrates diverse educational methodologies (Charlotte Mason, Montessori, unschooling, project-based learning) and local opportunities, adapting to regional preferences like language, measurement systems, timezones, and cultural contexts. The platform aims to offer an accessible, adaptable, and personalized learning solution with a focus on community integration and empowering parents.

## User Preferences
Preferred communication style: Simple, everyday language.
Default Language: Australian English (use "mum" not "mom", "colour" not "color", etc.) - but platform is locale-aware
Global Support: Application adapts to user's country, locale, and measurement system preferences

## System Architecture

### UI/UX Decisions
The platform features a responsive, mobile-first design using Shadcn/UI and Tailwind CSS with a golden yellow color scheme (HSL 45°) and Inter/Lexend typography. The dashboard presents a 12-week curriculum in an accordion layout with week preview cards, progress rings, and a sticky desktop calendar/mobile week selector. It includes a comprehensive settings page, a journal entry system with rich text editing, interactive Google Maps integration for local opportunities, and photo uploads. Expandable activity cards provide confidence-boosting examples across three difficulty levels, and the platform allows families to select from 8 educational philosophies, including a "Perfect Blend" option.

### Technical Implementations
The frontend is built with React, TypeScript, and Vite, using Wouter for routing, TanStack Query for server state, and React Hook Form with Zod for validation. The Node.js Express backend uses Drizzle ORM with PostgreSQL (Neon serverless) for type-safe database interactions. Authentication is handled by Replit Auth (OIDC), ensuring family-level data ownership. AI integration leverages Anthropic Claude for curriculum generation, which adapts to selected learning approaches and individual child learning needs (e.g., focus/attention, sensory sensitivities, dyslexia) with specific accommodation instructions. Real-time collaboration features include WebSockets for live presence and instant updates. Key features include smart children management, automatic curriculum regeneration on settings changes, production-ready error handling, and API optimizations. The system offers one-tap data control for downloading all data, deleting photos/journals, or a complete account deletion, and generates printable/tablet-friendly weekly curriculum PDFs with daily plans, material lists, local happenings, and journal prompts. A High School Mode provides a comprehensive transcript management system supporting 8 international education standards with standard-specific UI and PDF formats.

### System Design Choices
Core data models include Users, Families, Children, Curricula, Journal Entries, Local Opportunities, Upcoming Events, and Home Education Groups. Security measures include HTTPS-only cookies, environment-variable-based session secrets, CSRF protection, and Zod schema validation. Object storage for photos and assets uses Google Cloud Storage.

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