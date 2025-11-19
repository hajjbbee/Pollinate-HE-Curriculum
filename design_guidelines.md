# Design Guidelines: Evergreen Curriculum AI

## Design Approach
**Hybrid Design System** - Drawing from Notion's organizational clarity, Linear's refined typography, and Asana's task-oriented patterns. The application requires trust, warmth, and efficiency for family-focused educational planning across multiple regions.

## Core Design Principles
- **Clarity First**: Information-dense content must be scannable and hierarchical
- **Warm Professionalism**: Balance educational credibility with family-friendly approachability
- **Efficient Navigation**: Parents manage complex schedules - reduce cognitive load
- **Regional Flexibility**: Seamless adaptation for US, Australia, and New Zealand contexts

## Typography System

**Font Stack**: 
- Primary: Inter (via Google Fonts) - clean, highly legible for data
- Accent: Lexend (via Google Fonts) - friendly, warm for headings

**Hierarchy**:
- Hero/Page Titles: text-4xl/text-5xl, font-bold, Lexend
- Section Headers: text-2xl/text-3xl, font-semibold, Lexend  
- Card Titles: text-lg/text-xl, font-semibold, Inter
- Body Text: text-base, font-normal, Inter
- Captions/Meta: text-sm, font-medium, Inter
- Small Labels: text-xs, uppercase tracking-wide

## Layout System

**Spacing Primitives**: Use Tailwind units **2, 4, 6, 8, 12, 16** for consistency
- Component padding: p-4, p-6, p-8
- Section spacing: py-12, py-16
- Card gaps: gap-4, gap-6
- Tight spacing: space-y-2, space-y-4

**Grid System**:
- Dashboard: 12-column responsive grid
- Card layouts: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Weekly view: Full-width with collapsible child sections
- Max container width: max-w-7xl for main content

## Component Library

### Navigation
- Top navbar: Sticky header with family name, child quick-switcher, settings
- Sidebar (desktop): Collapsible navigation with icons - Dashboard, Curriculum, Journal, Opportunities, Settings
- Bottom nav (mobile): Fixed icons for primary sections

### Onboarding Flow
- Multi-step wizard: Progress indicator at top, large form fields, clear "Next" CTAs
- Country selector: Flag icons with country names
- Child cards: Rounded, friendly cards with add/remove actions
- Address input: Autocomplete with map preview (optional visual)

### Dashboard
- Weekly carousel: Horizontal scroll cards for 12 weeks, current week highlighted
- Family theme banner: Full-width, soft gradient background, large typography
- Child sections: Expandable accordions with avatar, age, mastery badges
- Daily plan: Grid layout Monday-Friday + Weekend summary
- Activity cards: Icon + title + description, subtle borders

### Curriculum View
- Calendar-style week grid with drag-to-reorder capability
- "Regenerate Week" button: Prominent, icon with spinner state
- Mastery progress: Horizontal badges/pills showing progression levels
- Deep dive chips: Colorful tags for topics of high interest

### Journal Entries
- Rich text editor: Clean toolbar, generous text area
- Photo upload: Drag-drop zone with thumbnail previews in grid
- Entry cards: Date header, child name badge, text preview, image thumbnails
- Filter/search: Date range picker, child selector

### Local Opportunities
- Opportunity cards: Image thumbnail (if available), name, address, drive time badge, cost label, "Why this fits" text, external link icon
- Map view: Interactive pins with popup cards
- Distance display: Adaptive (km for AU/NZ, miles for US)
- Filter controls: Distance slider, cost range, category tags

### Forms & Inputs
- Input fields: Rounded corners (rounded-lg), clear labels above, helper text below
- Buttons: Primary (solid), Secondary (outline), Tertiary (ghost) - all with rounded-lg
- Select dropdowns: Native styling enhanced with icons
- Toggles: Large, friendly switches for preferences
- Date pickers: Calendar popup with timezone awareness

### Data Display
- Stats cards: Icon, large number, small label - grid layout
- Tables: Zebra striping for readability, sticky headers
- Progress indicators: Linear progress bars with percentage labels
- Badges: Rounded-full pills for tags, statuses, mastery levels

### Overlays
- Modals: Centered, max-w-2xl, backdrop blur, close icon top-right
- Toasts: Bottom-right notifications, slide-in animation
- Tooltips: Minimal, appear on hover for icon explanations

## Animations
Use sparingly - only for functional feedback:
- Loading states: Subtle spinner on buttons during AI generation
- Accordion expand/collapse: Smooth height transition
- Toast notifications: Slide-in/fade-out
- NO decorative scroll animations or parallax effects

## Images

**Hero Section (Landing/Marketing)**:
- Large hero image: Warm family learning scene (parent with children at table with books/tablet)
- Position: Full-width banner, 60vh height, subtle overlay for text readability
- Buttons on hero: Use backdrop-blur-md background

**Dashboard/App**:
- Child avatars: Circular placeholders with initials or uploaded photos
- Opportunity thumbnails: Small square images (100x100) for local venues
- Journal photos: User-uploaded, displayed as thumbnail grid with lightbox on click

**Illustrations**: 
- Empty states: Friendly, simple line illustrations (e.g., "No journal entries yet")
- Onboarding steps: Optional small icons/illustrations to guide flow

## Accessibility
- Minimum touch targets: 44x44px for all interactive elements
- Form labels: Always visible, properly associated with inputs
- Color contrast: WCAG AA compliant for all text
- Focus states: Visible ring-2 ring-offset-2 on all interactive elements
- Keyboard navigation: Tab order follows visual hierarchy
- Screen reader: Semantic HTML, ARIA labels for icon buttons