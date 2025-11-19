# Design Guidelines: Evergreen Curriculum AI

## Design Approach
**Hybrid Design System** - Drawing from Notion's organizational clarity, Linear's refined typography, and Asana's task-oriented patterns. Creates trust, warmth, and efficiency for family-focused educational planning across US, Australia, and New Zealand.

## Core Design Principles
- **Clarity First**: Information-dense content must be scannable and hierarchical
- **Warm Professionalism**: Educational credibility with family-friendly approachability
- **Efficient Navigation**: Reduce cognitive load for parents managing complex schedules
- **Regional Flexibility**: Seamless adaptation for multiple regions

## Color System

**Nature-Inspired Green Palette**:
- **Primary Green**: Forest green #2D5F3F (buttons, primary CTAs, active states)
- **Secondary Green**: Sage green #7A9B7E (secondary buttons, borders, accents)
- **Light Green**: Soft mint #E8F4E8 (backgrounds, cards, subtle highlights)
- **Deep Green**: Evergreen #1A3D2E (headers, important text, navigation)

**Supporting Colors**:
- **Warm Neutrals**: Cream #FAF9F6 (page backgrounds), Warm gray #6B6B6B (body text)
- **Accent Earth Tones**: Terracotta #C95D3F (alerts, important badges), Golden #D4A574 (achievements, mastery)
- **Semantic Colors**: Success (growth green #4A7C4E), Warning (amber #E8A648), Error (rust red #C14E3D)

**Application**:
- Page backgrounds: Cream base with light green cards
- Navigation: Deep green sidebar/header with white text
- Primary actions: Forest green buttons with white text
- Secondary actions: Sage green outline buttons
- Disabled states: 40% opacity of primary colors
- Hover states: Darken primary by 10%
- Focus rings: Forest green with 2px offset

## Typography System

**Font Stack**: 
- Primary: Inter (Google Fonts) - data and body text
- Accent: Lexend (Google Fonts) - headings and warmth

**Hierarchy**:
- Hero/Page Titles: text-5xl font-bold Lexend, deep green
- Section Headers: text-3xl font-semibold Lexend, deep green
- Card Titles: text-xl font-semibold Inter, warm gray
- Body Text: text-base font-normal Inter, warm gray
- Captions: text-sm font-medium Inter, secondary gray
- Labels: text-xs uppercase tracking-wide, tertiary gray

## Layout System

**Spacing**: Tailwind units **2, 4, 6, 8, 12, 16**
- Component padding: p-6 (cards), p-8 (sections)
- Section spacing: py-16 (desktop), py-12 (mobile)
- Card gaps: gap-6
- Tight spacing: space-y-4

**Grid**: 12-column responsive, max-w-7xl containers

## Component Library

### Marketing/Landing Page
**Hero Section**: Full-width, 70vh height
- Large hero image: Warm family homeschool scene (parent with 2-3 children at wooden table with books, nature visible through window, soft natural lighting)
- Overlay: Subtle gradient (dark to transparent bottom-up) for text readability
- Headline: text-5xl Lexend bold in white, subheadline text-xl
- CTA buttons: Forest green primary + sage outline secondary, both with backdrop-blur-md
- Position: Centered text with buttons below

**Additional Sections**:
- Features grid: 3 columns (lg), 2 (md), 1 (sm) - icons in forest green circles, light green card backgrounds
- Benefits showcase: Alternating 2-column layout with images (children learning, nature scenes, family planning)
- Testimonials: 2-column cards with parent photos, sage green borders
- Pricing cards: Light green background for featured plan, forest green CTAs
- Footer: Deep green background, cream text, 4-column layout (product, company, resources, legal)

### Navigation
- Top navbar: Deep green background, cream text, sticky, child quick-switcher with avatar circles
- Sidebar (desktop): Deep green, collapsible with icons - Dashboard, Curriculum, Journal, Opportunities, Settings
- Bottom nav (mobile): Fixed, light green background, forest green active icons

### Dashboard Components
- **Weekly Carousel**: Horizontal scroll, light green cards, current week with forest green border (3px), golden badge for achievements
- **Family Theme Banner**: Full-width, soft gradient (light green to cream), large Lexend typography in deep green
- **Child Sections**: Expandable accordions, cream background, forest green headers, circular avatars with sage borders
- **Daily Plans**: Monday-Friday grid, weekend summary card, light green backgrounds, forest green activity icons
- **Activity Cards**: White background, sage borders, forest green icons, hover lifts with subtle shadow

### Curriculum View
- Calendar grid: White cells, light green current day, drag handles in forest green
- "Regenerate Week" button: Forest green, prominent placement, spinner state
- Mastery badges: Golden pills showing progression, terracotta for areas needing focus
- Deep dive chips: Colorful tags (various greens, earth tones) for high-interest topics

### Journal & Opportunities
- **Journal Entries**: White cards on cream background, forest green date headers, sage category badges, photo thumbnails in 3-column grid
- **Opportunity Cards**: Light green background, thumbnail images (if available), terracotta "distance" badges, forest green external link icons, "Why this fits" in warm gray text
- **Map View**: Interactive with forest green pins

### Forms & Inputs
- Fields: White background, sage border, rounded-lg, forest green labels
- Buttons: Primary (forest green solid), Secondary (sage outline), focus ring in forest green
- Toggles: Forest green when active, gray when off
- Date pickers: Forest green calendar accents

### Data Display
- **Stats Cards**: Light green background, forest green large numbers, icons in terracotta circles
- **Tables**: Alternating cream/white rows, deep green headers, sticky
- **Progress Bars**: Forest green fill on light green track, golden for mastery completion
- **Badges**: Rounded-full, forest green for active, sage for completed, terracotta for alerts

### Overlays
- Modals: White background, deep green headers, backdrop blur with cream tint
- Toasts: Light green background, forest green icons, slide-in from bottom-right
- Tooltips: Deep green background, cream text

## Images

**Hero Section**: Full-width 70vh banner with warm homeschool family scene
**Dashboard**: Circular child avatars (uploaded or initials on sage background)
**Opportunities**: Square thumbnails (120x120) for venues
**Journal**: User-uploaded photos in grid with lightbox
**Empty States**: Simple line illustrations in sage green
**Marketing Sections**: Family learning scenes, nature imagery, planning activities (2-3 images minimum)

## Animations
Minimal, functional only:
- Button loading: Forest green spinner
- Accordion transitions: Smooth height
- Toast notifications: Slide-in/fade
- NO decorative animations

## Accessibility
- Touch targets: 44x44px minimum
- Color contrast: WCAG AA (forest green on cream passes)
- Focus states: ring-2 ring-forest-green ring-offset-2
- Semantic HTML with ARIA labels
- Keyboard navigation following visual hierarchy