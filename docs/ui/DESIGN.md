---
name: Quản lý nhà trọ
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#006591'
  on-secondary: '#ffffff'
  secondary-container: '#39b8fd'
  on-secondary-container: '#004666'
  tertiary: '#943700'
  on-tertiary: '#ffffff'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#c9e6ff'
  secondary-fixed-dim: '#89ceff'
  on-secondary-fixed: '#001e2f'
  on-secondary-fixed-variant: '#004c6e'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-md-medium:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-xs:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system is engineered for landlords, property managers, and administrative teams operating boarding houses and micro-apartments in Vietnam. The tool balances high-throughput administrative velocity with approachability, removing the cognitive fatigue of tracking contracts, utility meters, and rental collections.

The aesthetic follows **Corporate / Modern SaaS Minimalism**:
- **Clarity over ornamentation:** Crisp geometry, structured information hierarchy, generous breathing room, and intentional typographic rhythm.
- **Reliability and trust:** Calibrated blues, balanced structural borders, and standardized status states to convey financial accuracy and contractual dependability.
- **Vietnamese typographic integrity:** Tuned strictly for diacritic legibility in administrative tables, compact room tags, and numeric financial summaries.

## Colors

The palette establishes high operational clarity against a clean canvas:

- **Primary Canvas & Surfaces:**
  - Base Canvas (`#F8FAFC`): A cool slate tint that reduces eye strain across multi-hour operational shifts.
  - Surface Card (`#FFFFFF`): Pristine white for container cards, navigation panels, and interactive elements.
  - Structural Border (`#E2E8F0`): Clean dividers defining card shells, table headers, and form inputs.

- **Primary Actions:**
  - Primary (`#2563EB`): Core interactive CTA, active navigation items, focus states.
  - Primary Hover (`#1D4ED8`): Deepened tone for active mouse press and hover feedback.
  - Primary Soft (`#EFF6FF`): Background pill indicators, row highlights, and active sidebar items.

- **Typography & Content Hierarchy:**
  - Text Primary (`#0F172A`): Deep slate for primary data, numerical values, and headings.
  - Text Muted / Secondary (`#64748B`): Supportive field descriptions, table column headers, and secondary labels.

- **Operational Status Palette (Badges & Alerts):**
  - Success (Paid / Occupied): Base `#16A34A` | Soft Fill `#DCFCE7` | Text `#15803D`
  - Warning (Pending / Expiring Soon): Base `#D97706` | Soft Fill `#FEF3C7` | Text `#B45309`
  - Danger (Overdue / Terminated): Base `#DC2626` | Soft Fill `#FEE2E2` | Text `#B91C1C`
  - Info (Vacant / Maintenance): Base `#0EA5E9` | Soft Fill `#E0F2FE` | Text `#0369A1`

## Typography

The typography uses **Inter** across all layers, taking advantage of its tall x-height, clear numeric tabular spacing, and full diacritic support for Vietnamese.

- **Editorial & Page Headings:** `headline-lg` (`24px / 600`) serves as the definitive level-one dashboard and screen header.
- **Section Titles & Module Headers:** `headline-sm` (`16px / 600`) anchors card modules, table title zones, and modal sheet headers.
- **Body & Tabular Readouts:** `body-md` (`14px / 400`) handles dense text, tenant metadata, and table records. `body-md-medium` (`14px / 500`) handles tenant names and key values.
- **Labels, Badges, & Metadata:** `label-sm` (`12px / 500`) and `label-xs` (`11px / 600`) provide compact, legible tags without clipping diacritics.

### Regional Formatting Standards
- **Currency:** Formatted using dot decimal groupings followed by space and currency marker: `3.500.000 đ`. Tabular figures should be enabled (`font-variant-numeric: tabular-nums`) for currency tables.
- **Dates:** Strictly formatted as `DD/MM/YYYY` (e.g., `25/12/2024`).
- **Phone Numbers:** Grouped in standard 4-3-3 pattern: `0901 234 567`.

## Layout & Spacing

The layout is built for **1440px desktop workspaces** using a fixed admin scaffold and fluid internal grids.

- **Primary Scaffold Geometry:**
  - **Left Navigation Rail (Sidebar):** Fixed `240px` width, anchored to the viewport height (`100vh`), border-right `1px solid #E2E8F0`, background `#FFFFFF`.
  - **Top Application Bar (Header):** Fixed `64px` height, full span right of the sidebar, border-bottom `1px solid #E2E8F0`, background `#FFFFFF`.
  - **Main Content Shell:** Viewport height minus header (`calc(100vh - 64px)`), scrollable `overflow-y: auto`, background `#F8FAFC`.
  - **Content Canvas Canvas Margin:** Standardized `32px` (`2rem`) padding wrapping all page views.

- **Card and Grid Mechanics:**
  - 12-column flex/CSS grid with `24px` (`1.5rem`) gutters.
  - Metric Summary Tiles: 4-column span (3 cards per row) or 3-column span (4 cards per row).
  - Main Table & Filter Container: 12-column span for primary operational lists.
  - Master-Detail Split: 8-column main record list, 4-column contextual property drawer.

## Elevation & Depth

Visual hierarchy relies on low-contrast structural outlines paired with subtle ambient diffusion. Harsh drop shadows are avoided in favor of crisp borders.

- **Level 0 (Flat Canvas / Sidebar / Header):**
  - Background `#FFFFFF` or `#F8FAFC`
  - Border: `1px solid #E2E8F0`
  - Shadow: None

- **Level 1 (Cards, Metric Containers, Table Shells):**
  - Background: `#FFFFFF`
  - Border: `1px solid #E2E8F0`
  - Shadow: `0px 1px 3px rgba(15, 23, 42, 0.04), 0px 1px 2px rgba(15, 23, 42, 0.02)`

- **Level 2 (Dropdown Menus, Popovers, Date Pickers, Hovered Cards):**
  - Background: `#FFFFFF`
  - Border: `1px solid #E2E8F0`
  - Shadow: `0px 4px 6px -1px rgba(15, 23, 42, 0.07), 0px 2px 4px -2px rgba(15, 23, 42, 0.05)`

- **Level 3 (Modals, Room Detail Drawers):**
  - Background: `#FFFFFF`
  - Backdrop: `rgba(15, 23, 42, 0.40)` with `backdrop-filter: blur(2px)`
  - Shadow: `0px 20px 25px -5px rgba(15, 23, 42, 0.10), 0px 8px 10px -6px rgba(15, 23, 42, 0.06)`

## Shapes

The design system maintains a balanced **8px (`0.5rem`) baseline radius** across interactive and container elements.

- **8px (`0.5rem`) - Default:** Input fields, dropdown triggers, standard buttons, cards, table wrappers, contextual dropdown menus, modals.
- **4px (`0.25rem`) - Compact:** Utility checkboxes, radio target centers, utility micro-tooltips.
- **9999px (Pill / Full Rounded):** Status indicator tags, room occupancy pills, user profile avatars, and icon-only floating badges.

## Components

### Buttons
- **Primary:** Background `#2563EB`, text `#FFFFFF`, font-weight 500, height 40px, padding `0 16px`, border-radius 8px. Hover: `#1D4ED8`. Active: `#1E40AF`.
- **Secondary / Outline:** Background `#FFFFFF`, border `1px solid #E2E8F0`, text `#0F172A`. Hover: background `#F8FAFC`, border `#CBD5E1`.
- **Ghost:** Background transparent, text `#64748B`. Hover: background `#F1F5F9`, text `#0F172A`.
- **Destructive:** Background `#DC2626`, text `#FFFFFF`. Hover: `#B91C1C`.

### Form Inputs & Search Fields
- Height 40px, background `#FFFFFF`, border `1px solid #E2E8F0`, border-radius 8px, padding `0 12px`, text `14px` (`#0F172A`).
- **Placeholder:** `#94A3B8`.
- **Focus State:** Border `#2563EB`, outline `2px solid #2563EB` with `outline-offset: 1px` (or `box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15)`).
- **Error State:** Border `#DC2626`, focus glow `rgba(220, 38, 38, 0.15)`.

### Status Badges (Pills)
- Border radius `9999px`, padding `4px 10px`, font size `12px`, font weight 500, inline-flex, item center.
  - **Đã thanh toán / Đang thuê (Success):** Background `#DCFCE7`, text `#15803D`.
  - **Chờ thanh toán / Sắp hết hạn (Warning):** Background `#FEF3C7`, text `#B45309`.
  - **Quá hạn / Đã trả phòng (Danger):** Background `#FEE2E2`, text `#B91C1C`.
  - **Phòng trống / Đang sửa chữa (Info):** Background `#E0F2FE`, text `#0369A1`.

### Navigation Rails & Header
- **Sidebar Navigation Links:** Height 40px, border-radius 8px, padding `0 12px`, color `#64748B`, font-size `14px`, display flex, items centered, gap `12px`.
  - **Active State:** Background `#EFF6FF`, text `#2563EB`, font-weight 600, positioned with a left accent bar (`width: 3px`, height `20px`, border-radius `2px`, background `#2563EB`).
- **Top Bar (64px):** Flex row, justify between, border-bottom `1px solid #E2E8F0`. Features property switcher dropdown ("Nhà trọ Thanh Xuân"), quick search, and landlord profile menu.

### Data Tables
- Wrapped in border `1px solid #E2E8F0`, background `#FFFFFF`, border-radius 8px, `overflow: hidden`.
- **Table Head (`<thead>`):** Height 40px, background `#F8FAFC`, border-bottom `1px solid #E2E8F0`, text `12px` font-weight 600, uppercase letter-spacing 0.05em, color `#64748B`.
- **Table Rows (`<tr>`):** Height 52px, border-bottom `1px solid #F1F5F9`, transition background 150ms. Hover: `#F8FAFC`.
- **Pagination Footer:** Height 56px, border-top `1px solid #E2E8F0`, flex alignment, showing item count ("Hiển thị 1-10 của 48 phòng") and page buttons.

### Specialized Utility Components
- **Utility Meter Counter Card:** Specialized input for electricity/water entry (`Số điện cũ`, `Số điện mới`, `Tiêu thụ`).
- **Room Status Grid Card:** Mini visual matrix card representing rooms (e.g., "P.101", "P.102") with a top color indicator representing current rental state.