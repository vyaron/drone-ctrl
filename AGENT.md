# Instructions for Agents

## General

When responding to the user always start with **Hopa!**

## Planning

Use the `plan/` folder to write down a plan before solving any task. Break the task into smaller steps and explain your reasoning before writing code.

Ask clarifying questions in the plan and wait for the user to answer before proceeding. This helps you better understand the requirements and avoid rework.

---

## Tech Stack

- **React 19** + **TypeScript 5** (strict mode)
- **Vite** as build tool
- **React Router v7** with `HashRouter` for client-side routing
- Plain **CSS** (no Tailwind, no CSS modules, no CSS-in-JS libraries)
- **Canvas 2D API** for tactical map rendering
- **Google Maps JavaScript API** for satellite view
- No external UI component libraries

---

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── canvas/          # Canvas drawing utilities (one function per file)
│   └── google/          # Google Maps integration hooks and overlays
├── pages/               # Route-level page components
└── utils/               # Shared types, constants, and utility functions
```

- **Barrel exports** (`index.ts`) in sub-folders (`canvas/`, `google/`)
- **One concern per file** for canvas utilities (e.g. `drawDrones.ts`, `drawGrid.ts`)
- All shared types, constants, and pure utility functions live in `src/utils/droneUtils.ts`

---

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Components | PascalCase | `DroneRow`, `DetailPanel` |
| Functions / hooks | camelCase | `drawDrones`, `formatTime`, `useDroneMarkers` |
| Types / Interfaces | PascalCase | `Drone`, `SeverityLevel`, `DroneRowProps` |
| Props interfaces | `[Component]Props` | `DroneRowProps` |
| Constants | UPPER_SNAKE_CASE | `WINDOW_SEC`, `BOUNDS` |
| CSS classes | kebab-case | `.nav-link`, `.stat-card` |

---

## TypeScript

- Always use TypeScript strict mode — no `any`, no implicit types
- Explicit return types on components: `function Foo(): ReactElement`
- Use `import type` for type-only imports: `import type { ReactElement } from 'react'`
- Union types for finite states: `'critical' | 'high' | 'medium' | 'low'`
- Define props interfaces inline in each component file

---

## Components

```typescript
import type { ReactElement } from 'react'
import { Something } from '../utils/droneUtils'

interface MyComponentProps {
  label: string
  value: number
}

function MyComponent({ label, value }: MyComponentProps): ReactElement {
  return <div>{label}: {value}</div>
}

export default MyComponent
```

- Functional components only — no class components
- Use `useRef` for mutable state that should not trigger re-renders (animation frames, drone arrays, hover state)
- Use `useState` for UI state that drives rendering (filters, selection, search)
- **Dual state pattern** for high-frequency data: store in `useRef`, sync to `useState` on a timer

```typescript
const dronesRef = useRef<Drone[]>([])
const [drones, setDrones] = useState<Drone[]>([])

useEffect(() => {
  const id = setInterval(() => setDrones([...dronesRef.current]), 300)
  return () => clearInterval(id)
}, [])
```

---

## Styling

- Plain CSS in `App.css` and `index.css` — no CSS modules, no Tailwind
- Inline `style` props are acceptable **only** for dynamic/runtime values (e.g. severity colors)
- Use CSS nesting to scope styles to their component context:
  ```css
  .drone-row {
    & .drone-label { ... }
    & .severity-badge { ... }
  }
  ```
- Use CSS variables for all repeated colors and values:
  ```css
  :root {
    --color-accent: #00d4ff;
    --color-bg: #070a0f;
  }
  ```
- Use `flex` and `grid` for layout
- Prefer `em` / `rem` over `px` for spacing and font sizes

### Color Palette

| Token | Value | Use |
|---|---|---|
| Accent cyan | `#00d4ff` | Primary UI accent |
| Background dark | `#070a0f` | Page background |
| Text dim | `#8899aa` | Secondary labels |
| Text bright | `#7ecfff` | Active values |
| Critical | `#ff2d55` | Severity: critical |
| High | `#ff8c00` | Severity: high |
| Medium | `#ffd60a` | Severity: medium |
| Low | `#30d158` | Severity: low |

---

## Event Handling

- Prefer inline handlers for simple interactions: `onClick={() => setFilter(f)}`
- Define named handlers for complex or reused logic: `function handleToggleTrails() { ... }`
- No global event bus — keep handlers local to the component that owns the state

---

## Canvas Rendering

- Use `requestAnimationFrame` loops — always cancel in the `useEffect` cleanup
- Track animation frame IDs and running state with refs

```typescript
useEffect(() => {
  let raf: number
  let isRunning = true

  function draw(ts: number) {
    if (!isRunning) return
    // ... render
    raf = requestAnimationFrame(draw)
  }

  raf = requestAnimationFrame(draw)
  return () => {
    isRunning = false
    cancelAnimationFrame(raf)
  }
}, [deps])
```

- Each drawing concern is a separate pure function in `src/components/canvas/`
- Canvas functions receive context and dimensions as parameters — no coupling to React state

---

## State Management

- No global state library (no Redux, no Zustand, no Context for data)
- All state is local to the page or component that owns it
- Pass data down via props

---

## Coding Style

- Single quotes in TypeScript/TSX
- Double quotes in JSX attribute strings: `className="my-class"`
- No semicolons (unless required by TypeScript syntax)
- Two-space indentation
