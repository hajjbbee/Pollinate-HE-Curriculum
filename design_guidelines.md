# Design Guidelines: Pollinate - Home Education Curriculum

## Design Approach
**Hybrid Design System** - Drawing from Notion's organizational clarity, Linear's refined typography, and Asana's task-oriented patterns. Creates trust, warmth, and efficiency for family-focused educational planning across US, Australia, and New Zealand.

## Core Design Principles
- **Clarity First**: Information-dense content must be scannable and hierarchical
- **Warm Professionalism**: Educational credibility with family-friendly approachability
- **Efficient Navigation**: Reduce cognitive load for parents managing complex schedules
- **Regional Flexibility**: Seamless adaptation for multiple regions

## Color System

**Warm Golden Yellow Palette**:
- **Primary Yellow**: Golden yellow #E6B54A (buttons, primary CTAs, active states)
- **Secondary Yellow**: Soft gold #F5D478 (secondary buttons, borders, accents)
- **Light Yellow**: Warm cream #FFF9E6 (backgrounds, cards, subtle highlights)
- **Deep Gold**: Rich amber #C69C3D (headers, important text, navigation)

**Supporting Colors**:
- **Warm Neutrals**: Cream #FAF9F6 (page backgrounds), Warm gray #6B6B6B (body text)
- **Accent Earth Tones**: Terracotta #C95D3F (alerts, important badges), Deep gold #D4A574 (achievements, mastery)
- **Semantic Colors**: Success (growth green #4A7C4E), Warning (amber #E8A648), Error (rust red #C14E3D)

**Application**:
- Page backgrounds: Cream base with light yellow cards
- Navigation: Deep gold sidebar/header with dark text
- Primary actions: Golden yellow buttons with dark text
- Secondary actions: Soft gold outline buttons
- Disabled states: 40% opacity of primary colors
- Hover states: Darken primary by 10%
- Focus rings: Golden yellow with 2px offset

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
- CTA buttons: Golden yellow primary + soft gold outline secondary, both with backdrop-blur-md
- Position: Centered text with buttons below

**Additional Sections**:
- Features grid: 3 columns (lg), 2 (md), 1 (sm) - icons in golden yellow circles, light yellow card backgrounds
- Benefits showcase: Alternating 2-column layout with images (children learning, nature scenes, family planning)
- Testimonials: 2-column cards with parent photos, soft gold borders
- Pricing cards: Light yellow background for featured plan, golden yellow CTAs
- Footer: Deep gold background, dark text, 4-column layout (product, company, resources, legal)

### Navigation
- Top navbar: Light background, dark text with golden yellow accents, sticky, child quick-switcher with avatar circles
- Sidebar (desktop): Light background, collapsible with icons - Dashboard, Curriculum, Journal, Opportunities, Settings, golden yellow active states
- Bottom nav (mobile): Fixed, light yellow background, golden yellow active icons

### Dashboard Components
- **Weekly Carousel**: Horizontal scroll, light yellow cards, current week with golden yellow border (3px), deep gold badge for achievements
- **Family Theme Banner**: Full-width, soft gradient (light yellow to cream), large Lexend typography in deep gold
- **Child Sections**: Expandable accordions, cream background, golden yellow headers, circular avatars with soft gold borders
- **Daily Plans**: Monday-Friday grid, weekend summary card, light yellow backgrounds, golden yellow activity icons
- **Activity Cards**: White background, soft gold borders, golden yellow icons, hover lifts with subtle shadow

### Curriculum View
- Calendar grid: White cells, light yellow current day, drag handles in golden yellow
- "Regenerate Week" button: Golden yellow, prominent placement, spinner state
- Mastery badges: Deep gold pills showing progression, terracotta for areas needing focus
- Deep dive chips: Colorful tags (various golds, earth tones) for high-interest topics

### Journal & Opportunities
- **Journal Entries**: White cards on cream background, golden yellow date headers, soft gold category badges, photo thumbnails in 3-column grid
- **Opportunity Cards**: Light yellow background, thumbnail images (if available), terracotta "distance" badges, golden yellow external link icons, "Why this fits" in warm gray text
- **Map View**: Interactive with golden yellow pins

### Forms & Inputs
- Fields: White background, soft gold border, rounded-lg, golden yellow labels
- Buttons: Primary (golden yellow solid), Secondary (soft gold outline), focus ring in golden yellow
- Toggles: Golden yellow when active, gray when off
- Date pickers: Golden yellow calendar accents

### Data Display
- **Stats Cards**: Light yellow background, golden yellow large numbers, icons in terracotta circles
- **Tables**: Alternating cream/white rows, deep gold headers, sticky
- **Progress Bars**: Golden yellow fill on light yellow track, deep gold for mastery completion
- **Badges**: Rounded-full, golden yellow for active, soft gold for completed, terracotta for alerts

### Overlays
- Modals: White background, deep gold headers, backdrop blur with cream tint
- Toasts: Light yellow background, golden yellow icons, slide-in from bottom-right
- Tooltips: Deep gold background, cream text

## Images

**Hero Section**: Full-width 70vh banner with warm homeschool family scene
**Dashboard**: Circular child avatars (uploaded or initials on sage background)
**Opportunities**: Square thumbnails (120x120) for venues
**Journal**: User-uploaded photos in grid with lightbox
**Empty States**: Simple line illustrations in soft gold
**Marketing Sections**: Family learning scenes, nature imagery, planning activities (2-3 images minimum)

## Animations
Minimal, functional only:
- Button loading: Golden yellow spinner
- Accordion transitions: Smooth height
- Toast notifications: Slide-in/fade
- NO decorative animations

## Accessibility
- Touch targets: 44x44px minimum
- Color contrast: WCAG AA (golden yellow on dark text passes, ensure sufficient contrast)
- Focus states: ring-2 ring-primary ring-offset-2
- Semantic HTML with ARIA labels
- Keyboard navigation following visual hierarchy