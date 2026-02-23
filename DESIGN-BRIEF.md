# VA Platform â€” Complete Design Brief for Implementation

> **For Claude Code:** This is your single source of truth for all UI implementation.
> Read this file before writing any frontend code.
> Interactive prototypes are in `design/prototypes/` for visual reference.

---

## Design Direction: Institutional Trust

**Philosophy:** "Bank-grade reliability" aesthetic. Inspired by Mercury, Gusto, Brex, Pilot.com.

**Key rules:**
- Serif headings convey authority and permanence
- Gold/emerald/amber accents used sparingly â€” never garish
- 4px border radius everywhere (sharp = serious, never rounded-full except status dots)
- Minimal shadows â€” 1px borders do the heavy lifting
- Monospace for ALL numbers, stats, timestamps, rates, IDs
- No emoji in production UI (prototypes use them as placeholders for icons)
- No translateY hover effects â€” border-color transitions only

---

### Branding

**Product name:** Hire Valerie
**Domain:** hirevalerie.com
**Logo mark:** 28px square, gold accent bg at 18% opacity, serif "V" initial. Adjacent text: "Hire Valerie" in DM Serif Display, white on dark backgrounds, navy (#1A1A2E) on light backgrounds.

All UI, copy, meta tags, and code comments must use "Hire Valerie" — never "VA Platform."

### Language Rules (CRITICAL — applies to ALL public-facing pages)

These rules apply to the landing page, auth pages, footer, meta tags, emails, and any text visible to users:

1. **Never abbreviate "virtual assistant"** — Always write "virtual assistant" (singular) or "virtual assistants" (plural). Never use "VA" or "VAs" in user-facing text. The only exception is internal dashboard labels where space is extremely constrained (e.g., table column headers at <60px width), and even then prefer abbreviation only as a last resort.
2. **Never reference "Filipino" or "Philippines"** — The platform is geography-neutral in public copy. Internal docs and business plans may reference the Philippines, but nothing user-facing.
3. **Consistent terminology:**
   - "virtual assistant" (not VA, not assistant, not freelancer)
   - "workspace" (not VPS, not desktop, not server)
   - "activity monitoring" (not surveillance, not tracking, not spying)
   - "client" or "company" (not employer — we're a marketplace, not an EOR)
4. **Internal dashboard exception:** On dashboard pages where authenticated users are deeply in-context, "VA" may appear in constrained UI elements (stat card labels, table headers, badge text). But page titles, descriptions, empty states, and body text should still spell it out where possible.

---

## Typography

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| Heading | DM Serif Display | 400 | Page titles, hero text, stat values, pricing |
| Body | DM Sans | 400, 500, 600, 700 | Body text, labels, buttons, navigation |
| Mono | JetBrains Mono | 400, 500 | Numbers, stats, timestamps, IDs, rates |

**Google Fonts:**
```
https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap
```

**Type scale:**
- Hero: 52px heading
- Section heading: 36px heading
- Page title: 22-26px heading
- Card heading: 18-20px heading
- Stat value: 22-28px heading
- Pricing: 48px heading
- Body large: 18px body
- Body: 14-15px body
- Body small: 12-13px body
- Label/caption: 10-11px body, semibold, uppercase, letter-spacing 1.5px
- Mono data: 11-12px mono

---

## Color System â€” Three Role Palettes

### Shared Colors (all roles)

| Token | Hex | Usage |
|-------|-----|-------|
| bg | #F6F5F2 | Page backgrounds |
| surface | #FFFFFF | Cards, form backgrounds |
| surface-alt | #F0EFEB | Table headers, alternating rows, subtle fills |
| text | #1A1A2E | Primary text |
| text-secondary | #5C5C6F | Body text, descriptions |
| text-muted | #8E8E9A | Captions, labels, timestamps |
| border | #E2E1DC | Card borders, dividers |
| border-light | #EDECE8 | Inner dividers, subtle separators |

### Status Colors (all roles)

| Status | Background | Text | Border |
|--------|-----------|------|--------|
| Success/Active | #EBF5F0 | #2D6A4F | #C6E0D4 |
| Warning/Pending/Idle | #FEF9EC | #92710A | #F0E2A8 |
| Error/Rejected | #FDF2F2 | #9B2C2C | #F5C6C6 |
| Info/Provisioning | #EFF6FF | #2563EB | #2563EB40 |
| Neutral/Closed | #F0EFEB | #8E8E9A | #E2E1DC |

### Company Palette (Navy + Gold)

| Token | Hex | Usage |
|-------|-----|-------|
| sidebar | #1A1A2E | Sidebar background |
| sidebar-hover | #2E2E50 | Sidebar hover |
| sidebar-active | #2E2E50 | Sidebar active item bg |
| accent | #B8982A | Gold â€” primary accent, links, highlights |
| accent-light | #D4B94E | Gold hover |
| accent-subtle | #F8F4E6 | Gold badge/callout backgrounds |
| text-on-dark | #9998A8 | Sidebar text |
| text-on-dark-bright | #DDDCE4 | Sidebar headings, active text |

### VA Palette (Forest Green + Emerald)

| Token | Hex | Usage |
|-------|-----|-------|
| sidebar | #0F2920 | Sidebar background |
| sidebar-hover | #163D30 | Sidebar hover |
| sidebar-active | #1C4A3A | Sidebar active item bg |
| accent | #2D8C64 | Emerald â€” primary accent |
| accent-light | #3AA878 | Emerald hover |
| accent-subtle | #EDF7F2 | Emerald badge/callout backgrounds |
| text-on-dark | #8BAFA3 | Sidebar text |
| text-on-dark-bright | #D0E5DD | Sidebar headings, active text |

### Monitor Palette (Slate + Amber) â€” NEW

| Token | Hex | Usage |
|-------|-----|-------|
| sidebar | #1C1F2E | Sidebar background (cooler than company navy) |
| sidebar-hover | #262A3C | Sidebar hover |
| sidebar-active | #31364A | Sidebar active item bg |
| accent | #D4870E | Amber â€” primary accent, alertness |
| accent-light | #E9A033 | Amber hover/bright |
| accent-subtle | #FDF6E9 | Amber badge/callout backgrounds |
| accent-dark | #B06F09 | Amber dark variant |
| text-on-dark | #8B8FA3 | Sidebar text |
| text-on-dark-bright | #D2D4E0 | Sidebar headings, active text |

### Admin Palette (Neutral Dark + Indigo)

| Token | Hex | Usage |
|-------|-----|-------|
| sidebar | #18181B | Sidebar background |
| accent | #6366F1 | Indigo accent |
| accent-subtle | #EEF2FF | Indigo subtle bg |

---

## Tailwind Config

```js
// tailwind.config.js extend block
module.exports = {
  theme: {
    extend: {
      colors: {
        'va-bg': '#F6F5F2',
        'va-surface': '#FFFFFF',
        'va-surface-alt': '#F0EFEB',
        // Company
        'va-navy': '#1A1A2E',
        'va-navy-light': '#2E2E50',
        'va-gold': '#B8982A',
        'va-gold-light': '#D4B94E',
        'va-gold-subtle': '#F8F4E6',
        // VA
        'va-forest': '#0F2920',
        'va-forest-light': '#1C4A3A',
        'va-emerald': '#2D8C64',
        'va-emerald-light': '#3AA878',
        'va-emerald-subtle': '#EDF7F2',
        // Monitor
        'va-slate': '#1C1F2E',
        'va-slate-light': '#31364A',
        'va-amber': '#D4870E',
        'va-amber-light': '#E9A033',
        'va-amber-subtle': '#FDF6E9',
        // Admin
        'va-admin': '#18181B',
        'va-indigo': '#6366F1',
        'va-indigo-subtle': '#EEF2FF',
        // Shared
        'va-text': '#1A1A2E',
        'va-text-secondary': '#5C5C6F',
        'va-text-muted': '#8E8E9A',
        'va-border': '#E2E1DC',
        'va-border-light': '#EDECE8',
        'va-success': '#2D6A4F',
        'va-success-bg': '#EBF5F0',
        'va-success-border': '#C6E0D4',
        'va-warning': '#92710A',
        'va-warning-bg': '#FEF9EC',
        'va-warning-border': '#F0E2A8',
        'va-error': '#9B2C2C',
        'va-error-bg': '#FDF2F2',
        'va-error-border': '#F5C6C6',
        'va-info': '#2563EB',
        'va-info-bg': '#EFF6FF',
      },
      fontFamily: {
        heading: ['"DM Serif Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        'va': '4px',
        'va-sm': '3px',
        'va-md': '5px',
      },
    },
  },
}
```

---

## Component Patterns

### Buttons
- **Primary (Company):** bg-[#1A1A2E] text-white, 4px radius, font-body font-semibold text-14px, padding 12px 24px
- **Primary (VA):** bg-[#0F2920] text-white
- **Primary (Monitor):** bg-[#1C1F2E] text-white OR bg-[#D4870E] text-white (for escalation actions)
- **Secondary:** bg-transparent, border 1px #E2E1DC, text-[#1A1A2E]
- **Danger:** bg-[#FDF2F2] text-[#9B2C2C] border 1px #F5C6C6
- **Loading:** Spinner icon + disabled opacity 0.6

### Status Badges
Font-body text-10px font-semibold, padding 3px 10px, border-radius 3px, 1px border.

| Status | Background | Text | Border |
|--------|-----------|------|--------|
| ACTIVE | #EBF5F0 | #2D6A4F | #C6E0D4 |
| PENDING | #FEF9EC | #92710A | #F0E2A8 |
| REJECTED | #FDF2F2 | #9B2C2C | #F5C6C6 |
| PROVISIONING | #EFF6FF | #2563EB | #2563EB40 |
| FAILED | #FDF2F2 | #9B2C2C | #F5C6C6 |
| OPEN | #FDF2F2 | #9B2C2C | #F5C6C6 |
| ACKNOWLEDGED | #FEF9EC | #92710A | #F0E2A8 |
| RESOLVED | #EBF5F0 | #2D6A4F | #C6E0D4 |
| INACTIVE | #F0EFEB | #8E8E9A | #E2E1DC |

### Severity Badges (Escalations)
Same as status badges but with font-weight 700.
- LOW â†’ success colors
- MEDIUM â†’ warning colors
- HIGH â†’ error colors

### Skill / Tag Chips
Font-body text-11px font-medium, padding 3px 9px, radius 3px, bg-[#F0EFEB] text-[#5C5C6F] border 1px #EDECE8

### Cards
bg-white, border 1px #E2E1DC, radius 4-5px, padding 20-28px.
Hover on clickable: border-color transitions to accent color (0.15s).

### Inputs
Font-body text-14px, padding 11px 14px, radius 4px, border 1px #E2E1DC, bg white.
Focus: border-color changes to accent (no box-shadow).

### Avatar Initials
34px square, radius 5px, bg-[#F0EFEB], border 1px #E2E1DC, font-body text-12px font-semibold.
Square-ish, NOT circular.

### Productivity Bars
Height 4-5px, radius 3px, bg-[#F0EFEB] track.
Fill: >85% green (#2D6A4F), 70-85% gold/amber, <70% red (#9B2C2C).

### Live Status Dots
8px circle, border-radius 50%. Active: #2D6A4F with box-shadow glow. Idle: #D4870E. Offline: #8E8E9A.

### Table Rows
Padding 12-14px 18px, border-bottom 1px #EDECE8. Hover: bg-[#F0EFEB].
Alert rows (idle VA): bg warningBg at 40% opacity. Offline: bg errorBg at 40%.

---

## Layout: Sidebar Pattern

All dashboards use the same layout shell:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚              â”‚ Header: Page title (serif 22px)           â”‚
â”‚   240px      â”‚         Subtitle (body 12px muted)        â”‚
â”‚   Sidebar    â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚   (sticky)   â”‚                                           â”‚
â”‚              â”‚ Content Area (padding 24-28px)             â”‚
â”‚   Nav items  â”‚                                           â”‚
â”‚   with icons â”‚                                           â”‚
â”‚              â”‚                                           â”‚
â”‚   User block â”‚                                           â”‚
â”‚   at bottom  â”‚                                           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Sidebar structure:**
- Top: Logo mark (28px square, accent bg at 18% opacity, serif initial) + "Hire Valerie" + role sub-label
- Navigation: icon + label + optional count badge. Active: lighter bg + accent icon + white text
- Bottom: User initials avatar + name + role/tier

**Company sidebar:** Navy (#1A1A2E), gold accents
**VA sidebar:** Forest (#0F2920), emerald accents, profile completion bar
**Monitor sidebar:** Slate (#1C1F2E), amber accents, shift status box

---

## Page-by-Page Specifications

---

### 1. Landing Page

13 sections. The landing page is the primary conversion surface for both companies and virtual assistants. Every section must reinforce "institutional trust" — the feeling that this platform has existed for years and handles everything professionally.

**Global rules for landing page copy:**
- Spell out "virtual assistant" / "virtual assistants" everywhere — no abbreviations
- Product name is "Hire Valerie" — never "VA Platform"
- No references to "Filipino" or "Philippines"
- Monospace font for all numbers, stats, prices, percentages
- Serif (DM Serif Display) for all section headings and stat values

**Sections in order:**

---

#### Section 1: Navigation (sticky)

Sticky top bar. Background: `rgba(250,250,248,0.92)` with `backdrop-blur(12px)`. Height ~64px. Max-width 1280px centered.

- **Left:** Logo mark (28px square, `bg-[#F8F4E6]` at 18% opacity, serif "V" in gold) + "Hire Valerie" in DM Serif Display 18px, navy color.
- **Center links (desktop):** "How It Works" · "Pricing" · "For Virtual Assistants" — font-body 14px, text-secondary. Smooth scroll anchors.
- **Right:** "Sign In" text link (font-body 14px semibold) + "Start Hiring →" primary button (bg navy, white text, 4px radius).
- **Mobile (below 768px):** Logo + hamburger menu. Links in slide-out drawer.

---

#### Section 2: Hero

The hero must feel substantial and alive — not empty. It's the first impression.

**Background:**
- Base: `bg-[#FAFAF8]`
- Grid texture overlay: repeating 1px white lines at 50px intervals, both axes, opacity 0.025
- Gold radial gradient: `radial-gradient(circle at top right, rgba(184,152,42,0.08), transparent 70%)`

**Layout:** Two-column on desktop (text left 55%, visual right 45%). Single column stacked on mobile.

**Left column content (top to bottom):**

1. **Heading (serif 52px, tracking-tight, leading-[1.12]):**
   "Hire Virtual Assistants. Stay in Control."
   — Two sentences, not three. Direct and authoritative.

2. **Subtitle (body 18px, text-secondary, max-width 540px, 16px top margin):**
   "Connect with skilled virtual assistants who work on secure, monitored cloud workspaces. See productivity in real-time. Revoke access instantly."

3. **Two CTA buttons (24px top margin, 12px gap):**
   - Primary: "Start Hiring →" (bg navy, white, 14px semibold, 12px 24px padding)
   - Secondary: "Join as a Virtual Assistant" (outlined, 1px border, navy text)

4. **Tabbed search bar (32px top margin):**
   A compact, functional search element that signals "marketplace."

   - Tab row: Two tabs — "Find Virtual Assistants" (gold underline when active) and "Find Jobs" (emerald underline when active). Font-body 13px semibold. Inactive: text-muted.
   - Search area: Single row — text input (flex 1, placeholder "Search by skill, role, or keyword...", 14px body, 12px 16px padding, 4px radius, 1px border) + action button.
     - Company tab active: button says "Search Talent →" (bg navy, white)
     - VA tab active: button says "Browse Jobs →" (bg forest, white)
   - Container: surface bg, 1px border, 5px radius, 12px padding. Subtle shadow: `0 2px 8px rgba(26,26,46,0.06)`.
   - On submit: navigates to `/dashboard/talent?q={query}` (company) or `/va/jobs?q={query}` (VA).

5. **Proof point stats (24px top margin, flex row, 24px gap):**
   Three inline stats. Each: mono value (22px heading) + body label (12px muted).
   - "2,400+" / "Virtual Assistants"
   - "$75/mo" / "Starting At"
   - "4.8★" / "Avg Rating"

**Right column (desktop only):**
- Floating dashboard preview card, rotated `rotate(1deg)`, subtle elevated shadow `0 8px 32px rgba(26,26,46,0.08)`.
- Shows a simplified mockup of the company dashboard: stat cards + a mini VA table with productivity bars.
- This is a static image or styled div — not functional.
- On mobile: hidden entirely (the left column content is sufficient).

---

#### Section 3: Logo Bar

Social proof strip. White background, 1px border top and bottom (#E2E1DC).

- Centered row of 5-6 company names in uppercase, font-body 11px semibold, letter-spacing 2px, text-muted.
- Placeholder names: "TECHSTARTUP CO" · "GROWTH AGENCY" · "ECOM BRANDS" · "SAAS COMPANY" · "DIGITAL FIRST" · "SCALE OPS"
- Heading above (optional): "Trusted by growing teams" in font-body 11px, text-muted, uppercase.
- Vertical padding: 24px.

---

#### Section 4: Problem / Solution

Two-column grid on white/surface background. Max-width 1080px centered. 48px vertical padding.

**Left column — "The Problem":**
- Section label (gold): "THE PROBLEM"
- Heading (serif 28px): "Hiring remotely is a trust problem"
- 4-5 pain points, each with a red ✗ icon (#9B2C2C) and body text (14px):
  - ✗ "You can't see what remote workers are actually doing"
  - ✗ "No way to verify hours or productivity"
  - ✗ "Company data lives on personal laptops"
  - ✗ "Revoking access takes days, not seconds"
  - ✗ "No accountability without micromanaging"

**Right column — "The Solution":**
- Section label (gold): "THE SOLUTION"
- Heading (serif 28px): "Monitored workspaces change everything"
- 4-5 solutions, each with a green ✓ icon (#2D6A4F) and body text (14px). **Bold the solution name:**
  - ✓ **"Cloud workspaces"** — Every virtual assistant works on an isolated, secure desktop
  - ✓ **"Real-time monitoring"** — See productivity scores, active hours, and screenshots
  - ✓ **"Instant revocation"** — Terminate workspace access with one click
  - ✓ **"Zero data risk"** — No company data on personal devices, ever
  - ✓ **"Built-in accountability"** — Professional monitoring without micromanaging

---

#### Section 5: How It Works

**Background:** surface-alt (#F0EFEB). 80px vertical padding.

**Header (centered):**
- Section label (gold): "HOW IT WORKS"
- Heading (serif 36px): "Get started in three simple steps"
- Subtitle (body 16px, text-secondary): "Whether you're hiring or looking for work."

**Layout:** Two-column, each with its own 3-step flow. 48px gap between columns.

**Left — "For Companies":**
Section label (gold, 11px uppercase): "FOR COMPANIES"

Each step: flex row. Left: step number in a 36px square (bg navy, white mono 14px text, 4px radius). Right: heading (body 16px semibold) + description (body 14px, text-secondary, 4px top margin). 20px gap between steps.

1. **"Post a Job"** — Describe the role, required skills, and your budget. Your listing goes live instantly.
2. **"Review & Hire"** — Browse applications, view profiles and ratings, then accept the best candidate. Their workspace starts provisioning immediately.
3. **"Monitor & Manage"** — Track productivity in real-time, view screenshots, and manage your virtual assistant from your dashboard. Revoke access instantly if needed.

**Right — "For Virtual Assistants":**
Section label (emerald, 11px uppercase): "FOR VIRTUAL ASSISTANTS"

Same step layout but with emerald accent (bg forest squares).

1. **"Create Your Profile"** — Showcase your skills, experience, and hourly rate. A strong profile helps you stand out to potential clients.
2. **"Apply to Jobs"** — Browse verified job listings, filter by your skills and rate preferences, and submit applications with a personalized cover letter.
3. **"Start Working"** — Once hired, you get a secure cloud workspace with all the tools you need. Work professionally from anywhere.

---

#### Section 6: Features (Dark Section)

**Background:** `bg-[#1A1A2E]` (navy). Grid texture overlay (1px white lines at 50px intervals, opacity 0.03). Gold radial gradient at top-right corner (8% opacity).

**Layout:** Max-width 960px centered. 80px vertical padding. Three features listed vertically, 48px gap between them.

**Header (centered):**
- Section label (gold, mono): "PLATFORM"
- Heading (serif 36px, white): "Why Hire Valerie?"
- Subtitle (body 16px, #9998A8): "We solve the trust problem in remote work. Every virtual assistant works on a monitored workspace, so you always know what you're paying for."

**Each feature:**
- Left: Monospace number in gold ("01", "02", "03") — font-mono 14px semibold, text-[#B8982A]
- Heading: serif 22px, white
- Body: font-body 15px, #9998A8 (muted on dark)
- Detail line: font-mono 12px, #B8982A (gold)

Features:
1. **"Isolated Workspaces"** — Each virtual assistant works on their own secure AWS WorkSpace. Cloud-based, zero data on personal devices, and terminate with one click. *Detail: "AWS WorkSpaces · Singapore region · <50ms latency"*
2. **"Activity Monitoring"** — Real-time productivity tracking with ActivTrak. See active hours, idle time, application usage, and automated screenshots every 10 minutes. *Detail: "ActivTrak integration · Screenshots · Productivity scores"*
3. **"Managed Monitoring"** — Optional dedicated human monitor who watches your virtual assistants so you don't have to. Escalation alerts for idle time, low productivity, or going offline. *Detail: "20:1 ratio · Escalation handling · Weekly reports"*

---

#### Section 7: Pricing

**Background:** surface (#FAFAF8). 80px vertical padding.

**Header (centered):**
- Section label (gold): "PRICING"
- Heading (serif 36px): "Simple, Transparent Pricing"
- Subtitle (body 16px, text-secondary): "Pay per virtual assistant, per month. Cancel anytime. Virtual assistants set their own rates."

**Two pricing cards** side by side, max-width 880px centered, 24px gap:

**Self-Service card:**
- bg white, 1px border #E2E1DC, 5px radius, 32px padding
- Title: "Self-Service" (serif 22px)
- Price: "$75" (serif 48px heading) + "/month per virtual assistant" (body 14px, muted)
- Description: "Perfect for teams managing their own virtual assistants" (body 14px, text-secondary)
- Feature list (6 items, check icons in navy):
  - Secure cloud workspace per virtual assistant
  - Real-time productivity monitoring
  - Screenshots every 10 minutes
  - Activity reports & dashboards
  - Instant access revocation
  - Email support
- CTA: "Get Started" secondary button (outlined, full width)

**Managed card (emphasized):**
- bg white, **2px border #B8982A** (gold), 5px radius, 32px padding
- **Shadow: `0 8px 32px rgba(26,26,46,0.08)`** (elevated)
- "MOST POPULAR" badge: gold-subtle bg, gold text, mono 10px semibold, 3px radius, top-right of card
- Title: "Managed" (serif 22px)
- Price: "$140" (serif 48px heading) + "/month per virtual assistant" (body 14px, muted)
- Description: "We monitor your virtual assistants so you don't have to" (body 14px, text-secondary)
- Feature list (6 items, check icons in gold):
  - Everything in Self-Service
  - Dedicated human monitor
  - Idle & productivity alerts
  - Escalation handling
  - Weekly summary reports
  - Priority support
- CTA: "Get Started" primary button (bg navy, white, full width)

**Disclaimer (centered, 16px top margin):**
"Platform fee only. Virtual assistant compensation is negotiated directly between you and your virtual assistant." (body 12px, text-muted)

---

#### Section 8: Testimonials

**Background:** surface-alt (#F0EFEB). 64px vertical padding.

**Header (centered):**
- Section label (gold): "TESTIMONIALS"
- Heading (serif 36px): "Trusted by growing teams"

**Three cards** in a 3-column grid, 20px gap:

Each card: bg white, 1px border, 5px radius, 24px padding.
- 5 gold stars (★★★★★) using font-mono 14px, color #B8982A
- Quote in italic (body 15px, text-secondary, line-height 1.6, 12px top margin)
- Divider (1px border-light, 16px vertical margin)
- Name (body 14px semibold) + Role/Company (body 12px, text-muted)

Placeholder testimonials:
1. ★★★★★ — *"We hired two virtual assistants through Hire Valerie and the monitoring gives us complete peace of mind. We can see exactly what they're working on without micromanaging."* — **Sarah Chen**, Operations Manager at TechScale
2. ★★★★★ — *"The managed plan is worth every penny. Our monitor flagged an issue before we even noticed. It's like having a team lead we don't have to train."* — **Marcus Rivera**, Founder at GrowthOps
3. ★★★★★ — *"As a virtual assistant, I love that my work is verified. Clients trust me from day one because they can see my productivity history on the platform."* — **Maria Santos**, Virtual Assistant

---

#### Section 9: For Virtual Assistants CTA

**Background:** white. 48px vertical padding.

Banner card: bg surface-alt (#F0EFEB), 1px border, 5px radius, 40px padding. Max-width 960px centered. Flex row on desktop (text left, CTA right). Stack on mobile.

- Heading (serif 28px): "Are you a virtual assistant?"
- Body (body 16px, text-secondary, 8px top margin, max-width 520px): "Create your free profile, browse verified job listings from US companies, and work from a professional cloud workspace with all tools included."
- CTA: "Create Your Profile →" outlined button (1px border, navy text, 14px semibold)

---

#### Section 10: FAQ

**Background:** surface (#FAFAF8). 80px vertical padding.

**Header (centered):**
- Heading (serif 36px): "Frequently Asked Questions"
- Subtitle (body 16px, text-secondary): "Everything you need to know about Hire Valerie"

**Accordion:** Max-width 680px centered. Each item:
- Surface bg, 1px border, 4px radius, 16px 20px padding, 8px gap between items
- Question: body 15px semibold, navy text
- Toggle icon: **plus (+) icon** that rotates 45deg on open (becomes ×). Not a chevron.
- Answer: body 14px, text-secondary, line-height 1.6, 8px top margin

Questions (all use "virtual assistant" not "VA"):
1. "How does the monitoring work?"
2. "Can virtual assistants access data on their personal computers?"
3. "How long does it take to set up a workspace?"
4. "What happens if I want to end a virtual assistant's contract?"
5. "How do virtual assistants get paid?"
6. "Is there a long-term commitment?"

**Answers must also spell out "virtual assistant" — no abbreviations in answer text.**

---

#### Section 11: Final CTA (Dark Section)

**Background:** `bg-[#1A1A2E]` (navy). Grid texture overlay (same as features section). Gold radial gradient bottom-left.

Centered content, 80px vertical padding.

- Heading (serif 36px, white): "Ready to get started?"
- Body (body 16px, #9998A8, 12px top margin): "Post your first job or create your virtual assistant profile today."
- Two buttons (24px top margin, 12px gap):
  - Primary: "Start Hiring →" (**bg gold #B8982A**, white text, 14px semibold) — this is the one section where gold is used as a button fill
  - Ghost: "Join as a Virtual Assistant" (1px white border at 30% opacity, white text)

---

#### Section 12: Footer

**Background:** surface-alt (#F0EFEB). Border-top 1px #E2E1DC.

Max-width 1280px centered. 48px top padding, 24px bottom padding.

**Top row:** 4-column grid.

- **Column 1 (brand):** Logo mark + "Hire Valerie" (serif 16px). Below: "The trusted marketplace for monitored virtual assistants. Secure workspaces, transparent monitoring, simple pricing." (body 12px, text-muted, max-width 240px)
- **Column 2 — "FOR COMPANIES":** Get Started, Pricing, Sign In
- **Column 3 — "FOR VIRTUAL ASSISTANTS":** Create Profile, Virtual Assistant Sign In
- **Column 4 — "LEGAL":** Privacy Policy, Terms of Service, Contact Us

Column headers: font-body 11px semibold, uppercase, letter-spacing 1.5px, text-muted. Links: font-body 13px, text-secondary, 8px vertical gap.

**Bottom row (separated by 1px border, 20px top margin/padding):**
- Left: "© 2026 Hire Valerie. All rights reserved." (body 12px, text-muted)
- Right: Remove "Powered by AWS WorkSpaces · Secured by ActivTrak" — do not advertise infrastructure vendors.

---

### 2. Auth Pages (4 total)

See prototype `va-platform-auth.jsx`.

**Layout:** Split 50/50. Left = dark brand panel (grid texture + radial gradient). Right = form.

| Page | Left Panel Color | Accent | Left Content |
|------|-----------------|--------|-------------|
| Company Sign In | Navy #1A1A2E | Gold | Testimonial + 3 stats |
| Company Sign Up | Navy #1A1A2E | Gold | Testimonial + 3 stats |
| VA Sign In | Forest #0F2920 | Emerald | Testimonial + 3 stats |
| VA Sign Up | Forest #0F2920 | Emerald | 4 perks list |
| Monitor Sign In | Slate #1C1F2E | Amber | Shift schedule + 3 stats |

**VA Sign Up unique element:** Toggleable skill selector chips (emerald when selected) + monitoring consent checkbox

**Monitor Sign In unique element:** "Monitor accounts are provisioned by admins" info box. No sign-up page â€” admins create monitor accounts.

---

### 3. Company Dashboard

See prototype `va-platform-dashboard.jsx`.

**Sidebar nav:** Dashboard, My VAs, Jobs (count badge), Talent, Billing, Settings

**Overview page:**
- 4 stat cards (Active VAs, Avg Productivity, Hours Today, Monthly Spend)
- Two-column: Productivity bar chart (5-day) + Activity feed timeline
- VA table: avatar, name/role, status badge, hours (mono), productivity bar + %, current app, "View â†’"

**Jobs page:** Card list with title, date, rate/hours, applicant count, status badge

**Job Detail (/dashboard/jobs/[id]):** Full spec in **Section 14** below. See prototype `va-prototype-job-detail-company.jsx`. Summary: Job info card + expandable applicant cards with skill matching, cover letter blockquotes, and hire/reject actions.

**Messages (/dashboard/messages):** Full spec in **Section 15** below. See prototype `va-prototype-messaging-company.jsx`. Summary: Two-panel chat UI with conversation list + message thread, gold accent.

**Talent page:** Grid of VA cards with search + skill filters. Match score bars.

**Billing page:** Current plan card + cost breakdown table + Stripe portal link

**Escalations tab (Managed tier only):** See Section 10 below.

---

### 4. VA Dashboard

See prototype `va-platform-va-dashboard.jsx`.

**Sidebar nav:** Dashboard, Find Jobs, Applications, Profile, Earnings, Settings
**Sidebar extras:** Profile completion bar, availability dot

**Overview:** Welcome banner (dark green) + 4 stat cards + Current Position card + Application Activity feed + Recommended Jobs

**Find Jobs:** Search + filters. Job cards with "â˜… Strong Match" badge (â‰¥90%), skill chips, "Apply â†’"

**Job Detail (/va/jobs/[id]):** Full spec in **Section 16** below. See prototype `va-prototype-va-job-detail.jsx`. Summary: Job info with skill match indicator + collapsible inline apply form + company sidebar.

**Messages (/va/messages):** Full spec in **Section 15** below. See prototype `va-prototype-messaging-va.jsx`. Summary: Same two-panel chat UI as company, emerald accent.

**Applications:** Tabs (All/Pending/Accepted/Rejected) with counts. Cover letter in blockquote. Withdraw on pending.

**Profile:** Two-column. Left: profile card with rate/experience/timezone table. Right: About Me, Skills chips, Work History, Portfolio.

**Earnings (/va/earnings):**
- Three stat cards: This Period (emerald dot), Last Period, All Time — values in font-heading, hours in font-mono
- Current period card: period date range (mono), pay frequency badge, three-column grid (Hours Worked / Hourly Rate / Total), progress bar showing hours worked vs period progress
- Payment history table: 7 columns (Period, Hours, Rate, Amount, Status badge, Payment Method, Date), 10-per-page pagination
- Dispute form: clicking a PENDING row reveals textarea + Submit Dispute button (emerald primary)
- Empty state: "No earnings recorded yet" with muted icon

---

### 5. Company VA Detail (/dashboard/vas/[id])

See prototype `va-platform-remaining.jsx`, tab "Company VA Detail".

**Header:** Back link + VA avatar/name/role + status badge + workspace ID (mono) + Message/Settings/Terminate buttons

**Stats row (5 cards):** Today's Hours, Productivity, Active Time, Current App, This Month (hours + estimated cost)

**Two-column layout:**
- **Left: Hourly Activity Chart** â€” Stacked bars (active=green, idle=amber) for each hour. Productivity % above each bar. Today/Yesterday/Week toggle. Below chart: Top Applications breakdown (app name + horizontal bar + time in mono). Scheduled breaks highlighted in amber but labeled "not flagged."
- **Right: Screenshots** â€” Chronological list. Each: thumbnail placeholder (72Ã—48px), app name, description, timestamp (mono). Break screenshots get amber tint. "View Full Gallery â†’" link at top. Hover: border turns gold.

**Screenshot Full Gallery:** "View Full Gallery" link navigates to `/dashboard/vas/[id]/screenshots`. Full spec in **Section 17** below. See prototype `va-prototype-screenshot-gallery.jsx`.

**Payments section (below activity, above workspace bar):**
- Pay frequency dropdown: WEEKLY/BIWEEKLY/MONTHLY, saves via PATCH /api/vas/[id], gold-bordered select
- Current period card: gold section label "CURRENT PERIOD", period dates (mono), hours/rate/total grid, status badge
- Unpaid alert: warning-bg banner when unpaid periods exist, shows count and total amount
- Payment history table: Period, Hours, Rate, Amount, Status badge, Actions column
- Mark as Paid form (inline on row click): payment method dropdown (Bank Transfer/PayPal/Wise/Check/Other), reference input, date picker, Confirm button (gold primary)
- Disputed rows show dispute reason in error-bg block

**Bottom bar:** Workspace details row â€” Workspace ID, Region, AD Username, ActivTrak ID, Bundle (all mono values)

---

### 6. Monitor Dashboard

See prototype `va-platform-monitor.jsx`, tab "Monitor Dashboard".

**Sidebar (Slate + Amber):**
- Logo with "Monitor" sub-label
- Nav: Dashboard, My VAs (count badge), Escalations (count badge)
- Shift status box: amber bg at 8% opacity, shows VA count + open escalations
- User block at bottom

**Overview page:**

**Alert banner (top):** Red bg when HIGH severity escalations are open. "3 open escalations require attention â€” 1 high severity unresolved for 2+ hours." View All button.

**Stats (4 cards):** Assigned VAs (X of 20), Active Now (X idle Â· X offline), Avg Productivity, Open Escalations

**Two-column:**
- **Left: VA Status Grid** â€” 6-column grid of square cells, one per VA. Each: initials + productivity %. Border color = status (green active, amber idle, red offline). Legend below. This is the monitor's "command center" â€” scan 20 VAs at a glance.
- **Right: Urgent Escalations** â€” Recent escalation cards with VA name, type badge (â¸ IDLE / ðŸ“‰ UNPRODUCTIVE / ðŸ”Œ OFFLINE / ðŸ“ CUSTOM), severity badge, description, company + time, "Escalate" button.

---

### 7. Monitor VA List (/monitor/vas)

See prototype `va-platform-monitor.jsx`, tab "Monitor Dashboard" â†’ "My VAs".

**Filter buttons:** All (18), Active (14), Idle (3), Offline (1)

**Table columns:** VA (avatar + name/role), Company, Status (live dot), Hours (mono), Productivity (bar + %), Current App, Actions

**Row highlighting:** Idle VAs â†’ amber tint background. Offline VAs â†’ red tint background.

**Actions:** Normal VAs get subtle "View" button. Idle/offline VAs get prominent amber "âš  Flag" button.

---

### 8. Monitor VA Detail (/monitor/vas/[id])

See prototype `va-platform-remaining.jsx`, tab "Monitor VA Detail".

**Header:** Back link + VA avatar (bordered in amber if idle) + name/role + live status dot + company/rate. "Message VA" secondary button + "âš  Create Escalation" amber primary button.

**Alert banner:** When VA is idle: amber bg, "Idle for 47 minutes Â· Last active on QuickBooks at 1:28 PM Â· No break scheduled"

**Stats (4 cards):** Hours Today, Productivity, Idle Time, Escalations (this month). Cards with amber borders when values are concerning.

**Activity Timeline:** Chronological list. Each entry: time (mono), colored dot (green=productive, amber=idle, blue=login), event description, detail text. Flag entries get amber warning badge "âš " and amber tint on row.

**Escalation Form (inline, toggled by button):**
Opens below header when "Create Escalation" clicked. Amber top accent bar.
- **Type selector:** 4 buttons in a row (â¸ Idle, ðŸ“‰ Unproductive, ðŸ”Œ Offline, ðŸ“ Custom). Active: amber-subtle bg, amber border.
- **Severity selector:** 3 buttons (LOW=green, MEDIUM=amber, HIGH=red). Active: colored bg + border.
- **Title input:** Pre-filled based on context (e.g., "Idle for 45+ minutes â€” no scheduled break")
- **Description textarea:** Pre-filled with context. Monitor edits/adds details.
- **Auto-Attached Context box:** surfaceAlt bg, shows VA name, Company, Idle duration, Last App, Today's Productivity (all pulled automatically, not editable)
- **Actions:** Cancel + "Submit Escalation â†’" (amber primary)

---

### 9. Monitor Escalation List (/monitor/escalations)

See prototype `va-platform-monitor.jsx`, tab "Monitor Dashboard" â†’ "Escalations".

**Tab filters:** Open (count), Acknowledged (count), Resolved (count), All (count). Active tab: amber-subtle bg + amber border.

**"+ New Escalation" button** (top right, dark bg)

**Escalation cards:** Each has:
- Left border: 3px colored by severity (red/amber/green)
- Header row: ESC-XXX (mono), VA name, type badge, severity badge, status badge
- Description paragraph
- Footer: company + timestamp (mono) + action buttons
- Open escalations: "Edit" secondary + "Send to Client" amber primary
- Acknowledged/Resolved: no actions, read-only

---

### 10. Company Escalation View (/dashboard/escalations)

See prototype `va-platform-monitor.jsx`, tab "Company Escalations".

**This is a new tab in the existing company dashboard sidebar (only visible for Managed tier).**

**Header:** Breadcrumb "Company Dashboard â†’ Escalations" + title + subtitle + two stat boxes (Open count, This Week count)

**Escalation cards:** Same severity-colored left border pattern. Each shows:
- VA name + type badge + severity badge + status badge
- "Reported by [Monitor Name] Â· [timestamp]"
- Description in surfaceAlt blockquote (left border)
- Monitor's action note in italic with ðŸ’¬ prefix
- Actions for OPEN: Acknowledge (primary), Resolve (secondary), Message Monitor (secondary)

**Empty state (no escalations):** Green checkmark icon, "No escalations â€” everything looks good. Your dedicated monitor is watching your VAs and will flag any issues here."

---

### 11. Admin Monitor Management (/admin/monitors)

See prototype `va-platform-monitor.jsx`, tab "Admin Management".

**Header:** "Admin Panel" indigo label + "Monitor Management" title + "+ Add Monitor" button

**Stats (4 cards):** Total Monitors, VAs Assigned (X of Y capacity, percentage), Open Escalations, Avg Response Time

**Monitor table columns:** Monitor (name + email + shift), Status badge, Capacity (bar + X/20 count), Open Esc. (red if >0), Resolved (count), Avg Response, Actions (Manage + Assign buttons)

**Capacity bars:** Color shifts green â†’ amber â†’ red as monitors approach max cap.

**Auto-assignment info box:** Indigo-subtle bg. "When a Managed-tier company hires a VA, they're automatically assigned to the monitor with the lowest VA count. Currently: [Monitor Name] would receive next assignment (X/20)."

---

### 12. Workspace Provisioning States

See prototype `va-platform-remaining.jsx`, tab "Workspace Provisioning".

These states appear on the company VA detail page and in the VA list row during provisioning.

**Three states:**

**PROVISIONING (in progress):**
- Icon: â³, color: info blue (#2563EB)
- Title: "Setting up workspace..."
- Subtitle: "This typically takes 15-20 minutes"
- Progress bar: blue, ~40% with "~12 min remaining" (mono)
- Step list: âœ“ VA record created â†’ âœ“ AD user created â†’ â— WorkSpace provisioning (active, blue glow) â†’ â—‹ ActivTrak install â†’ â—‹ Ready for login

**ACTIVE (complete):**
- Icon: âœ…, color: success green
- Title: "Workspace active"
- All steps checked green
- Workspace details box: green bg, shows Workspace ID, AD User, Registration Code, Region (all mono)

**FAILED:**
- Icon: âŒ, color: error red
- Title: "Provisioning failed"
- Failed step: âœ• in red with "Timeout â€” retry" link
- "Retry Provisioning" red button + "Contact Support" secondary

**VA list row variants:**
- ACTIVE row: green status badge + "ws-XXXXX Â· 6.5h today Â· 91% productivity"
- PROVISIONING row: blue badge + "Setting up workspace... ~12 min" + mini progress bar
- FAILED row: red badge + "AD user creation failed â€” retry available" + red "Retry" button

---

### 13. Onboarding Empty States

See prototype `va-platform-remaining.jsx`, tab "Onboarding Empty States".

**General pattern:** Large muted icon (48-56px, opacity 0.2-0.3) â†’ serif heading (20-24px) â†’ body description (13-14px, max-width 420px centered) â†’ primary CTA button â†’ optional supporting info

**Company â€” First Login (0 VAs):**
- ðŸš€ icon
- "Hire your first virtual assistant"
- Two buttons: "Post a Job" (primary) + "Browse Talent" (secondary)
- 3-step hint below divider: Post â†’ Accept â†’ Workspace auto-provisions (numbered boxes with mono numbers)

**Company â€” No Jobs Posted:**
- ðŸ“‹ icon
- "No jobs posted yet"
- "Average time to first applicant: 4 hours"
- "Post Your First Job â†’" button

**Company â€” No Escalations (Managed tier, good state):**
- âœ… green icon with success bg/border
- "No escalations â€” everything looks good"
- "Your dedicated monitor is watching your VAs and will flag any issues here."

**VA â€” No Profile:**
- âœï¸ icon
- "Complete your profile to start applying"
- "Create Your Profile â†’" button
- Trust points: "Free to join Â· Set your own rate Â· 14 open jobs"

**VA â€” No Applications:**
- ðŸ“„ icon
- "No applications yet"
- "Companies typically respond within 48 hours"
- "Find Jobs â†’" button

---

---

### 14. Job Detail + Applicants (/dashboard/jobs/[id])

See prototype `va-prototype-job-detail-company.jsx`.

**Breadcrumb:** "Jobs > [Job Title]"

**Job info card (top):**
- Title (serif 22px) + status badge (OPEN/CLOSED/FILLED) inline
- Posted date (mono) + applicant count (mono)
- Edit button (secondary) + Close Job button (danger: errorBg + error text + errorBorder)
- Description paragraph (14px body, max-width 720px, line-height 1.65)
- Rate range + hours/week displayed with section labels + mono values
- Requirements as Chip components in a flex-wrap row

**Applicants section:**
- Section label (gold) "APPLICANTS" + heading "[count] Applications" (serif 18px)
- Filter buttons row: All / Pending / Accepted / Rejected. Active filter: goldSubtle bg + gold text + gold border at 30% opacity. Inactive: transparent bg + muted text + border.

**Applicant cards (expandable, click to toggle):**
- Card: surface bg, 1px border, 5px radius, 20px padding. Left border: 3px colored by status (success=accepted, error=rejected, default border=pending). Border-color transition 0.15s on hover.
- **Collapsed row:** Avatar (40px, success accent border if accepted) + name (14px semibold) + status badge + "★ Full Match" gold badge (when all requirements matched) + experience years (mono) + hourly rate (mono) + star rating (gold stars, mono score) + review count (mono, muted) + applied date (mono)
- **Expanded section (slides open below row):**
  - Cover letter in blockquote: surfaceAlt bg, 3px left border (#E2E1DC), border-radius 0 4px 4px 0, 12px 16px padding. Label: 10px uppercase "COVER LETTER" in muted. Body: 13px, line-height 1.6, textSecondary.
  - Skill match display: label "Skills (X/Y match)" in 10px uppercase muted. Chips row: matched skills use successBg/success/successBorder with "✓ " prefix. Unmatched use default surfaceAlt chip styling.
  - Actions row (separated by 1px borderLight top border, 8px top padding):
    - PENDING: "View Profile" (secondary) + "Accept & Hire" (primary navy) + "Reject" (danger)
    - ACCEPTED: "✓ Hired" text in success + "View workspace provisioning →" as gold underlined link
    - REJECTED: no actions shown

---

### 15. Messaging UI (/dashboard/messages + /va/messages)

See prototypes `va-prototype-messaging-company.jsx` and `va-prototype-messaging-va.jsx`. Shared design token constants in `va-prototype-shared.jsx`.

This is a shared two-panel chat interface used by both companies and VAs. The layout and behavior are identical — only the accent color changes.

**Layout:** Two-panel, total height 620px, bg background, 1px border, 5px radius. Left: 300px conversation list (surface bg, border-right). Right: fluid message thread (bg background).

**Conversation list panel (left):**
- Header: serif heading "Messages" (18px) + search input (13px body, 8px 12px padding, 4px radius, border focus transitions to accent)
- Each conversation row: 12px 16px padding, 1px borderLight bottom
  - Avatar (38px) with online status dot (10px circle, success=online, muted=offline, 2px white border)
  - Name (13px semibold) + timestamp (mono 10px muted, right-aligned, flex-shrink 0)
  - Role or job title (11px muted)
  - Last message preview (12px, truncated with text-overflow ellipsis at 170px max-width, 500 weight if unread, 400 if read)
  - Unread count badge: accent-colored circle (18px diameter), mono 10px white text, centered
- Active conversation: accent-subtle bg + 3px solid accent left border
- Sort order: unread conversations float to top, then by recency
- Transition: all 0.12s

**Message thread panel (right):**
- **Header (surface bg, border-bottom):** 14px 20px padding. Avatar (36px) + name (14px semibold) + role/job context (11px muted). Right side: 8px online status dot (with glow shadow if online) + "Online"/"Offline" label (11px).
- **Job context banner (centered):** surfaceAlt bg, 1px borderLight border, 4px radius, 8px 16px padding. "Conversation about: **[Job Title]**" (company) or "Re: **[Job Title]**" (VA). Font-body 11px, title in semibold textSecondary.
- **Message bubbles:**
  - Own messages: right-aligned, accent-subtle bg, 1px accent border at 25% opacity
  - Other's messages: left-aligned, surface bg, 1px standard border
  - All bubbles: max-width 72%, padding 10px 14px, 4px radius, 13px body text, line-height 1.5
  - 8px vertical gap between sender switches (when sender changes)
  - Timestamp cluster: mono 10px muted, shown after the last message in a sender's consecutive group, with 3px top margin
  - Read receipts on own messages only: "✓✓" in success color for read, "✓" in muted for sent
- **Input area (surface bg, 1px border-top):** 12px 20px 16px padding.
  - Textarea: flex 1, 13px body, 10px 14px padding, 4px radius, 1px border, 40px min-height, 100px max-height, resize none. Focus: border-color transitions to accent.
  - Send button: primary (navy for company, forest for VA), 13px semibold, 10px 20px padding. Opacity 0.5 when input is empty, 1.0 when has content. Transition: opacity 0.15s.
  - Helper text: "Press Enter to send · Shift+Enter for new line" (10px muted, 4px top margin)
- **Empty state (no conversation selected):** Centered vertically, icon (36px, 15% opacity) + serif heading "Select a conversation" (18px muted) + body "Choose a conversation to start messaging" (13px muted)

**Role variants:**
- **Company:** Gold accent — goldSubtle message bg, gold unread badges, gold active conversation border, navy send button
- **VA:** Emerald accent — emeraldSubtle message bg, emerald unread badges, emerald active conversation border, forest send button

---

### 16. VA Job Detail + Apply (/va/jobs/[id])

See prototype `va-prototype-va-job-detail.jsx`.

**Breadcrumb:** "Find Jobs > [Job Title]" (emerald link)

**Layout:** Two-column with 24px gap. Left: main content (flex 1). Right: sidebar (260px, flex-shrink 0).

**Main content — Job info card (surface bg, 1px border, 5px radius, 24px padding):**
- Company header row: Avatar (44px) + company name (12px muted above) + job title (serif 22px, 2px top margin)
- Meta row (surfaceAlt bg, 12px 16px padding, 4px radius, 18px bottom margin): Four data blocks in flex row, separated by 1px vertical dividers (28px height) with 16px gap between blocks. Each block: 10px uppercase label (muted, 1px letter-spacing, 2px bottom margin) + value (mono 14px, text color). Fields: Rate, Hours, Posted, Applicants.
- Description: section label (muted) "DESCRIPTION" + body paragraph (14px, line-height 1.65, textSecondary, 6px top margin)
- Requirements: section label (muted) "REQUIREMENTS" + flex-wrap chips (6px gap, 6px top margin). Matched skills: successBg + success text + successBorder + "✓ " prefix. Unmatched: standard surfaceAlt styling.
- Skill match indicator (full-width, 12px 16px padding, 4px radius):
  - 4+ matches: successBg + successBorder. Label: "★ Strong Match" (13px semibold success). Text: "You match **X** of **Y** required skills" (12px textSecondary, bold numbers in mono).
  - <4 matches: warningBg + warningBorder. Label: "Partial Match" (13px semibold warning). Same text pattern.

**Apply section (below job card, 16px top margin):**
- **Not applied — collapsed:** Surface card, 1px border, 5px radius. Centered padding 24px. Single CTA: "Apply for This Position →" (forest primary, 14px semibold, 12px 28px padding).
- **Not applied — expanded (clicking CTA):** Card with no overflow.
  - Header bar: emeraldSubtle bg, 1px emerald border at 25% bottom, 12px 24px padding. "Apply for [Job Title]" (14px semibold, forest text).
  - Form body (24px padding):
    - Cover letter: label (12px semibold, 6px bottom margin) + textarea (13px, 10px 14px padding, 4px radius, 1px border, 5 rows, vertical resize, emerald focus border, line-height 1.5)
    - Highlighted skills: label (12px semibold, 6px bottom margin) + flex-wrap chips of VA's skills (matched ones in success style)
    - Actions (8px gap): "Submit Application →" (forest primary, 13px semibold, 10px 24px) + "Cancel" (secondary, 13px, 10px 16px)
- **Applied — confirmed state:** Surface card, 1px border, 5px radius, 24px padding.
  - Status row: PENDING badge (warning) + "Applied [date]" (12px muted, mono date)
  - Cover letter blockquote: surfaceAlt bg, 3px left border, 0 4px 4px 0 radius, 12px 16px padding. 10px uppercase label + 13px body text.
  - Withdraw button: danger style (errorBg + error text + errorBorder, 12px, 7px 14px padding)

**Sidebar (260px):**
- Company info card (surface bg, 1px border, 5px radius, 18px padding): Emerald section label "ABOUT [COMPANY]" + description (13px textSecondary, line-height 1.5) + stat rows (12px top margin, 6px gap). Each stat: label (12px muted, left) + value (mono 12px text, right), flex space-between. Stats: Active VAs, Avg Rating, Member Since.
- Benefits card (same card styling, 12px top margin): Emerald section label "WHAT YOU GET" + checklist (8px top margin, 8px gap). Each item: "✓" in success (12px, 1px top margin) + text (12px textSecondary), flex row with 8px gap. Items: Monitored VPS workspace, ActivTrak time tracking, Verified work history, Direct client communication.

---

### 17. Screenshot Full Gallery (/dashboard/vas/[id]/screenshots)

See prototype `va-prototype-screenshot-gallery.jsx`.

**Breadcrumb:** "[VA Name] > Screenshots" (gold link on VA name)

**Header:** Gold section label "ACTIVITY SCREENSHOTS" + VA name (serif 20px heading). Controls (right-aligned, flex row, 10px gap): date picker input (mono 12px, 7px 12px padding, 4px radius, 1px border) + view toggle (two-button group: "grid"/"timeline", 1px border wrapper, 4px overflow radius. Active: goldSubtle bg + gold text. Inactive: surface bg + muted text. 11px, 6px 14px padding. 1px internal border between buttons).

**Grid view (default, 3-column CSS grid, 12px gap):**
- Screenshot card: surface bg, 1px border (errorBorder #F5C6C6 if unproductive, standard border otherwise), 5px radius, overflow hidden. Hover: border-color transitions to gold (0.15s).
- Thumbnail area: 16:10 aspect ratio, bg #F8F9FA (or errorBg #FDF2F2 if unproductive), flex center. App initial as large watermark (mono 28px, 15% opacity, colored per app — see app color map below).
  - Flagged badge (top-right, absolute, 6px offset): errorBg + error text + errorBorder, 9px semibold, 2px 6px padding, 2px radius. Text: "⚠ FLAGGED".
  - Timestamp overlay (bottom-left, absolute, 6px offset): rgba(0,0,0,0.6) bg, white mono 10px, 2px 6px padding, 2px radius.
- Meta row (10px 12px padding): app name (12px body semibold, text) + duration (mono 10px muted, right-aligned), flex space-between.

**Timeline view (vertical layout, 80px left padding):**
- Vertical line: 2px wide, border color, absolute positioned at left 56px, top 0 to bottom 0.
- Each entry (16px bottom margin, relative positioning):
  - Timestamp (absolute, left -80px, 60px width, right-aligned): mono 11px muted, 10px top padding.
  - Status dot (absolute, left -28px, top 10px): 10px circle, z-index 1, 2px white border. Productive: success green. Unproductive: error red.
  - Card (flex 1): flex row, 12px gap, surface bg, 1px border (errorBorder if unproductive), 5px radius, 12px padding. Hover: border-color to gold.
    - Thumbnail: 120px width, 16:10 ratio, 3px radius, 1px borderLight, centered app initial watermark (mono 20px, 15% opacity).
    - Meta column (flex, vertical, centered, 4px gap): app name (13px semibold) + flagged badge if unproductive + URL (12px muted) + "Duration: [time]" (mono 11px muted).

**Expand modal (click any screenshot):**
- Overlay: fixed, full viewport, rgba(0,0,0,0.7) bg, flex center, z-index 1000. Click overlay to close.
- Modal: surface bg, 5px radius, 720px width, max-height 85vh, overflow-y auto, 1px border.
  - Preview area: 16:10 aspect ratio, bg #F3F4F6 (or errorBg), flex center. App name as giant watermark (mono 64px, 8% opacity, app-colored).
  - Meta section (24px padding):
    - Header row: app name (serif 18px) + timestamp (12px muted) on left. Classification badge (success/error variant) on right.
    - Details grid (4-column, surfaceAlt bg, 14px padding, 4px radius, 12px gap, 16px top margin): Application, URL, Duration, Classification. Each: 10px uppercase label (muted, 1px letter-spacing, 3px bottom margin) + mono 12px value (text color).
    - Navigation row (flex space-between, 16px top margin): "← Previous" / "Close" / "Next →" buttons (secondary style: transparent bg, 1px border, textSecondary, 12px body, 7px 14px padding, 4px radius).

**App color map (for watermark tinting):**

| App | Color |
|-----|-------|
| Google Sheets | #0F9D58 |
| Slack | #4A154B |
| QuickBooks | #2CA01C |
| Gmail | #EA4335 |
| Notion | #000000 |
| Google Docs | #4285F4 |

## Visual Texture Patterns

**Grid texture (dark sections):**
```css
background-image:
  repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 50px),
  repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 50px);
```
Used on: hero bg, features section, final CTA, auth left panels, sidebar accents.

**Radial gradient accents:**
```css
background: radial-gradient(circle at top right, rgba(ACCENT, 0.08), transparent 70%);
```
Positioned at corners. Gold for company, emerald for VA, amber for monitor.

---

## Database Models for Monitor Features (Prisma additions)

```prisma
model Monitor {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])
  
  maxVAs          Int      @default(20)
  shift           String?  // "DAY" or "NIGHT"
  status          MonitorStatus @default(ACTIVE)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  assignments     MonitorAssignment[]
  escalations     Escalation[]
  
  @@index([status])
}

enum MonitorStatus {
  ACTIVE
  INACTIVE
}

model MonitorAssignment {
  id              String   @id @default(cuid())
  monitorId       String
  monitor         Monitor  @relation(fields: [monitorId], references: [id])
  vaId            String
  va              VA       @relation(fields: [vaId], references: [id])
  
  assignedAt      DateTime @default(now())
  unassignedAt    DateTime?
  
  @@unique([monitorId, vaId])
  @@index([monitorId])
  @@index([vaId])
}

model Escalation {
  id              String   @id @default(cuid())
  monitorId       String
  monitor         Monitor  @relation(fields: [monitorId], references: [id])
  vaId            String
  companyUserId   String   // The company that hired this VA
  
  type            EscalationType
  severity        EscalationSeverity
  status          EscalationStatus @default(OPEN)
  
  title           String
  description     String
  
  // Auto-attached context
  idleDuration    Int?     // minutes
  productivityPct Int?
  lastApp         String?
  
  resolvedAt      DateTime?
  acknowledgedAt  DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([monitorId])
  @@index([vaId])
  @@index([companyUserId])
  @@index([status])
}

enum EscalationType {
  IDLE
  UNPRODUCTIVE
  OFFLINE
  CUSTOM
}

enum EscalationSeverity {
  LOW
  MEDIUM
  HIGH
}

enum EscalationStatus {
  OPEN
  ACKNOWLEDGED
  RESOLVED
}
```

**User model addition:** Add `MONITOR` to the `UserType` enum.

---

## Route Structure for Monitor Features

```
app/src/app/
  (monitor)/                    # Monitor route group
    layout.tsx                  # Slate+amber sidebar layout
    monitor/
      dashboard/page.tsx        # Monitor overview
      vas/page.tsx              # VA list with live status
      vas/[id]/page.tsx         # VA detail + escalation creation
      escalations/page.tsx      # Escalation list
  
  (dashboard)/                  # Company additions
    dashboard/
      escalations/page.tsx      # Company escalation view (managed tier only)
  
  (admin)/                      # Admin route group
    admin/
      monitors/page.tsx         # Monitor management
  
  (auth)/
    monitor/
      sign-in/page.tsx          # Monitor sign-in (no sign-up)
  
  api/
    monitors/route.ts           # Monitor CRUD
    monitors/[id]/route.ts
    escalations/route.ts        # Escalation CRUD
    escalations/[id]/route.ts
    monitor-assignments/route.ts # Assignment management
```

---

## Implementation Priority

1. **Tailwind config** â€” Add all color tokens, font families, border radius
2. **Shared components** â€” Button, Badge, SeverityBadge, Card, Input, StatCard, Avatar, ProductivityBar, LiveDot, EmptyState
3. **Layout shells** â€” Company sidebar, VA sidebar, Monitor sidebar (all from same base component with role-based theming)
4. **Prisma schema** â€” Add Monitor, MonitorAssignment, Escalation models + MONITOR user type
5. **Auth** â€” Monitor sign-in route
6. **Monitor dashboard** â€” Overview â†’ VA list â†’ VA detail + escalation form â†’ Escalation list
7. **Company escalation view** â€” New tab in company dashboard
8. **Admin monitor management** â€” Internal tool
9. **Provisioning states** â€” Update VA detail page and VA list rows
10. **Empty states** â€” Add to all pages that can be empty
11. **Landing page redesign** â€” Apply new design system
12. **Auth page redesign** â€” Apply new design system
13. **Messaging UI** — Two-panel chat for company + VA (shared component, role-themed)
14. **Job detail + applicants** — Expanded company view with skill matching
15. **VA job detail + apply** — Two-column with inline apply form
16. **Screenshot full gallery** — Grid/timeline views with expand modal

---

## Prototype Files Reference

| File | Contents |
|------|----------|
| `design/prototypes/va-platform-landing.jsx` | Landing page (12 sections) |
| `design/prototypes/va-platform-dashboard.jsx` | Company dashboard (5 views) |
| `design/prototypes/va-platform-va-dashboard.jsx` | VA dashboard (6 views) |
| `design/prototypes/va-platform-auth.jsx` | Auth pages (4 pages) |
| `design/prototypes/va-platform-monitor.jsx` | Monitor dashboard + company escalations + admin + monitor sign-in |
| `design/prototypes/va-platform-remaining.jsx` | Company VA detail + Monitor VA detail + Escalation form + Onboarding + Provisioning |
| `design/prototypes/va-prototype-shared.jsx` | Shared design tokens (T, font) and reusable components (Badge, Avatar, Chip, Mono, SectionLabel, StarRating) |
| `design/prototypes/va-prototype-messaging-company.jsx` | Messaging UI — Company view (gold accent, 4 mock conversations) |
| `design/prototypes/va-prototype-messaging-va.jsx` | Messaging UI — VA view (emerald accent, 3 mock conversations) |
| `design/prototypes/va-prototype-job-detail-company.jsx` | Job Detail + Applicants — Company view (expandable cards, skill matching, hire actions) |
| `design/prototypes/va-prototype-va-job-detail.jsx` | VA Job Detail + Apply (two-column layout, inline apply form, skill match indicator) |
| `design/prototypes/va-prototype-screenshot-gallery.jsx` | Screenshot Full Gallery (grid/timeline views, expand modal, app color coding) |
