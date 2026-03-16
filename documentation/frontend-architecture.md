# PearlDesk — Frontend Architecture

> Frontend-specific technical reference for the `frontend` repository.  
> Last updated: 2026-03-14

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Architecture Principles](#architecture-principles)
4. [Routing](#routing)
5. [State Management](#state-management)
6. [Authentication](#authentication)
7. [Forms & Validation](#forms--validation)
8. [UI Components](#ui-components)
9. [API Client](#api-client)
10. [Multi-Tenancy](#multi-tenancy)
11. [Naming Conventions](#naming-conventions)
12. [Testing Strategy](#testing-strategy)
13. [Local Development](#local-development)

---

## Tech Stack

| Concern | Library | Version |
|---|---|---|
| Framework | React | 19.x |
| Language | TypeScript | 5.x |
| Build tool | Vite | latest |
| Routing | React Router | v7 |
| Server state | TanStack Query | v5 |
| Forms | React Hook Form + Zod | latest |
| UI components | Shadcn/ui | latest |
| Styling | Tailwind CSS | v4 |

---

## Project Structure

```
pearldesk-web/
+-- documentation/               ? This folder (FE-specific docs)
+-- src/
¦   +-- features/                ? Feature-sliced modules
¦   ¦   +-- patients/
¦   ¦   +-- appointments/
¦   ¦   +-- treatments/
¦   ¦   +-- billing/
¦   ¦   +-- staff/
¦   ¦   +-- identity/
¦   ¦   +-- ...
¦   +-- components/              ? Shared UI components
¦   ¦   +-- ui/                  ? Shadcn/ui primitives
¦   ¦   +-- layout/              ? Shell, sidebar, header
¦   +-- lib/
¦   ¦   +-- api.ts               ? Axios/fetch API client
¦   ¦   +-- auth.ts              ? Token store, refresh logic
¦   ¦   +-- utils.ts             ? Shared utilities
¦   +-- routes/                  ? React Router route definitions
¦   ¦   +-- index.tsx
¦   ¦   +-- _protected.tsx       ? Auth guard wrapper
¦   ¦   +-- _public.tsx
¦   +-- hooks/                   ? Shared custom hooks
¦   +-- types/                   ? Shared TypeScript types/interfaces
+-- public/
+-- index.html
+-- vite.config.ts
+-- tailwind.config.ts
+-- tsconfig.json
```

### Feature Folder Structure
Each feature under `src/features/{feature}/` follows:

```
features/patients/
+-- components/          ? Feature-specific UI components
¦   +-- PatientCard.tsx
¦   +-- PatientTable.tsx
+-- hooks/               ? Feature-specific custom hooks
¦   +-- usePatientList.ts
¦   +-- useCreatePatient.ts
+-- api/                 ? API query/mutation functions
¦   +-- patients.api.ts
+-- schemas/             ? Zod validation schemas
¦   +-- patient.schema.ts
+-- types/               ? Feature-specific TypeScript types
    +-- patient.types.ts
```

---

## Architecture Principles

- **TypeScript always** — never plain JS
- **Feature-sliced** — feature code lives in its feature folder; only truly shared code goes in `components/` or `lib/`
- **Server state via TanStack Query** — never `useState` + `useEffect` for API data
- **All routes lazy-loaded** — no eager imports of feature components in the router
- **No business logic in components** — extract to hooks or API functions

---

## Routing

React Router v7 with lazy-loaded feature routes:

```tsx
// routes/index.tsx
const router = createBrowserRouter([
  {
    path: '/',
    element: <ProtectedLayout />,
    children: [
      {
        path: 'patients',
        lazy: () => import('../features/patients/routes/PatientsPage'),
      },
      {
        path: 'patients/:id',
        lazy: () => import('../features/patients/routes/PatientDetailPage'),
      },
    ],
  },
  {
    path: '/login',
    lazy: () => import('../features/identity/routes/LoginPage'),
  },
]);
```

All authenticated routes are wrapped in a role-based route guard that checks the in-memory token and user role before rendering.

---

## State Management

| Type | Tool | Rule |
|---|---|---|
| Server state | TanStack Query | All API data — queries + mutations |
| Form state | React Hook Form | All form inputs |
| Global UI state | React Context (minimal) | Auth context, theme |
| Local UI state | `useState` | Modals, toggles, local UI only |

**Never** use `useState` + `useEffect` to fetch data. **Never** use a global store (Redux, Zustand) for server data.

---

## Authentication

### Token Strategy
- **Access token** — stored in **memory only** (React context / module-level variable)
  - Never `localStorage`, never `sessionStorage`
  - Lifetime: 15 minutes
- **Refresh token** — HttpOnly cookie, never accessible from JS
  - Handled automatically by the browser on every refresh call

### Silent Refresh Flow
```
Access token expires
    ? API call returns 401
    ? Interceptor calls POST /api/v1/auth/refresh (sends cookie automatically)
    ? New access token received ? stored in memory
    ? Original request retried
    ? If refresh fails ? redirect to /login
```

### HIPAA Idle Timeout
- Inactivity timer: **15–30 minutes** (configurable)
- On timeout: clear in-memory token, redirect to `/login`
- Timer resets on any user interaction (mouse, keyboard, touch)

### Route Guards
```tsx
function ProtectedRoute({ allowedRoles }: { allowedRoles: Role[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" />;
  return <Outlet />;
}
```

---

## Forms & Validation

All forms use **React Hook Form + Zod**:

```tsx
// schemas/createPatient.schema.ts
export const createPatientSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName:  z.string().min(1, 'Last name is required').max(100),
  email:     z.string().email('Invalid email address'),
  dateOfBirth: z.string().date('Invalid date'),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;

// components/CreatePatientForm.tsx
const form = useForm<CreatePatientInput>({
  resolver: zodResolver(createPatientSchema),
});
```

Rules:
- Every form has a Zod schema in `schemas/`
- Types are inferred from schemas — never manually duplicated
- Never use uncontrolled forms or manual validation
- Always show field-level error messages using Shadcn/ui `FormMessage`

---

## UI Components

- **Shadcn/ui** for all base components (Button, Input, Dialog, Table, etc.)
- Extend with Tailwind CSS utility classes — never write custom CSS
- Shared components (used across features) live in `components/`
- Feature-specific components stay inside their feature folder

### Loading / Error / Empty States
Every data-fetching component **must** handle all three states:

```tsx
function PatientList() {
  const { data, isLoading, isError } = usePatientList();

  if (isLoading) return <PatientListSkeleton />;    // Shadcn Skeleton
  if (isError)   return <ErrorMessage />;            // Error UI
  if (!data?.length) return <EmptyState />;         // Empty UI

  return <Table data={data} />;
}
```

Never show a blank UI during loading.

---

## API Client

Axios instance with JWT interceptor:

```ts
// lib/api.ts
const api = axios.create({ baseURL: '/api/v1', withCredentials: true });

// Attach access token to every request
api.interceptors.request.use(config => {
  const token = getAccessToken(); // from memory
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(null, async error => {
  if (error.response?.status === 401 && !error.config._retry) {
    error.config._retry = true;
    const token = await refreshAccessToken(); // calls /auth/refresh
    setAccessToken(token);
    return api(error.config);
  }
  return Promise.reject(error);
});
```

---

## Multi-Tenancy

- Tenant detected from subdomain on app bootstrap: `{slug}.pearldesk.com`
- Slug stored in React context — passed to all API calls via base URL or header
- If tenant not found ? redirect to marketing/login page

---

## Naming Conventions

| Artefact | Convention | Example |
|---|---|---|
| React components | `PascalCase` | `PatientCard`, `AppointmentCalendar` |
| Custom hooks | `camelCase` prefixed `use` | `usePatientList`, `useBookAppointment` |
| API functions | `camelCase` | `getPatientById`, `createAppointment` |
| Zod schemas | `camelCase` + `Schema` | `createPatientSchema` |
| Feature folders | Mirror BE module names | `features/patients/` |
| TypeScript types | `PascalCase` | `Patient`, `AppointmentStatus` |
| Route files | `PascalCase` + `Page` | `PatientsPage.tsx` |

---

## Testing Strategy

| Layer | Tool | Target |
|---|---|---|
| Unit — hooks | Vitest + React Testing Library | Custom hooks, API functions |
| Unit — components | Vitest + React Testing Library | Isolated component rendering |
| E2E | Playwright | Critical user flows (login, book appointment) |

---

## Local Development

### Prerequisites
- Node.js 22+
- pnpm (preferred) or npm

### Start Dev Server
```bash
pnpm install
pnpm dev
```
App available at `http://localhost:5173`

### Environment Variables
Create `.env.local`:
```
VITE_API_BASE_URL=http://localhost:5000
VITE_TENANT_SLUG=demo
```

