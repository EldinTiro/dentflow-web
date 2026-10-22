# DentFlow Web — Agent Reference

React 19 + TypeScript, Vite, TanStack Query, React Hook Form + Zod, Shadcn/ui, Tailwind CSS 4, Zustand, i18next.

## Tech Stack

| Concern        | Library                     |
|----------------|-----------------------------|
| Framework      | React 19 + TypeScript 5.7   |
| Build          | Vite 6                      |
| Routing        | React Router 7              |
| Server state   | TanStack Query v5           |
| Forms          | React Hook Form + Zod       |
| UI components  | Shadcn/ui + lucide-react    |
| Styling        | Tailwind CSS v4             |
| Client state   | Zustand 5                   |
| HTTP client    | Axios (with interceptors)   |
| i18n           | i18next (en, bs, de)        |
| Notifications  | Sonner (toasts)             |

## Project Structure

```
dentflow-web/src/
├── features/           # Feature-sliced modules (primary code location)
│   ├── auth/
│   ├── appointments/
│   ├── patients/
│   ├── staff/
│   ├── treatments/
│   ├── billing/
│   ├── admin/
│   ├── dashboard/
│   ├── shell/          # App shell / layout
│   └── users/
├── shared/
│   ├── api/            # Axios client + interceptors (shared/api/client.ts)
│   ├── components/     # Shared UI components (not feature-specific)
│   ├── context/        # React context (ThemeContext)
│   ├── lib/            # Utility functions
│   └── utils/
├── routes/             # React Router route tree (lazy-loaded)
├── locales/            # i18n JSON files (en/, bs/, de/)
├── App.tsx
├── main.tsx            # Entry: QueryClient, BrowserRouter, i18n init
└── i18n.ts
```

## Feature Folder Structure

Every feature follows this structure — do not deviate:

```
features/{feature}/
├── components/    # Feature-specific UI components
├── hooks/         # Custom hooks (usePatients, useCreatePatient, etc.)
├── pages/         # Route-level page components
├── services/      # API calls (axios functions)
├── types/         # TypeScript types/interfaces for this feature
└── index.ts       # Barrel export
```

## Common Commands

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Type check
npm run type-check   # or: npx tsc --noEmit

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

## Adding a New Feature

1. Create `src/features/{feature}/` with the full folder structure above
2. Add a lazy-loaded route in `src/routes/index.tsx`
3. Add translations to `src/locales/en/`, `bs/`, `de/`
4. Export the feature entry from `features/{feature}/index.ts`

## API Client

All HTTP calls go through the shared Axios instance at `src/shared/api/client.ts`.

```typescript
// In features/{feature}/services/patientService.ts
import { apiClient } from '@/shared/api/client';

export const getPatient = (id: string) =>
  apiClient.get<PatientResponse>(`/api/v1/patients/${id}`).then(r => r.data);
```

- `apiClient` has **`baseURL: ''`** — always write the full `/api/v1/...` path in the service. Vite proxies `/api` in dev, nginx proxies it in prod
- `Authorization: Bearer {token}` and `Accept-Language` are injected automatically by the request interceptor
- **On 401 the interceptor refreshes once and retries.** It calls `refreshAccessToken()` (single-flight: concurrent 401s share one `/auth/refresh`, because a second rotation would look like token reuse and revoke the family), then replays the request. Only if the refresh fails does it `clearAuth()`. Calls to `/api/v1/auth/*` are never retried

## Server State (TanStack Query)

```typescript
// hooks/usePatient.ts
export function usePatient(id: string) {
  return useQuery({
    queryKey: ['patients', id],
    queryFn: () => getPatient(id),
  });
}

// hooks/useCreatePatient.ts
export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success(t('patients.created'));
    },
  });
}
```

- Default stale time: 5 minutes (configured globally in `main.tsx`)
- Default retry: 1
- Always invalidate related query keys on mutation success
- Use `queryKey` arrays consistently: `['resource', id]` or `['resource', { filters }]`

## Forms

```typescript
const schema = z.object({
  firstName: z.string().min(1),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
});
```

- Always define Zod schema first, infer the TypeScript type from it
- Never use uncontrolled inputs without React Hook Form
- Server-side validation errors from `ErrorOr` responses should surface via `setError('root', ...)`

## Auth State (Zustand)

```typescript
import { useAuthStore } from '@/features/auth/store/authStore';

// Actual store surface — there is no `token`, `setToken` or `logout` member
const { accessToken, user, isAuthenticated, setAuth, clearAuth, hasRole } = useAuthStore();
```

- **The access token lives in memory only** (Zustand store, no `persist`). A cold load restores the session from the HttpOnly refresh cookie (`restoreSession()` in `App.tsx`); the legacy `pearldesk-auth` localStorage key is deleted on boot
- **Refresh token**: HttpOnly cookie scoped to `/api/v1/auth`, rotated on every refresh, family revoked on reuse. `logout()` calls `/auth/logout` so the server revokes it too
- **Select roles with `useAuthStore(selectRoles)`**, never `s.user?.roles ?? []` — a fresh `[]` per call makes Zustand 5 re-render forever when nobody is signed in
- `user.mustChangePassword` is set after signing in with a temporary password; `ProtectedRoute` then sends the user to `/change-password` (the API refuses everything else until it is changed)
- Use `hasRole(...)` to read the current user's role for conditional rendering

## Routing & Route Guards

```typescript
// routes/index.tsx — lazy-loaded routes
const PatientsPage = lazy(() => import('@/features/patients/pages/PatientsPage'));

// Protected route wraps all authenticated pages
// Role-based access: pass `allowedRoles` prop to the guard
<ProtectedRoute allowedRoles={['Dentist', 'ClinicOwner', 'Receptionist']}>
  <PatientsPage />
</ProtectedRoute>
```

## i18n

```typescript
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();
// Usage: t('patients.createSuccess')
```

- All user-facing strings must go through `t()` — no hardcoded English strings in JSX
- Translation keys live in `src/locales/{en,bs,de}/{feature}.json`
- Namespace = feature name (e.g., `patients`, `appointments`)

## Multi-Tenancy (Frontend)

- In prod: resolved by subdomain on the API side — the frontend does not manage this
- Never hardcode tenant IDs anywhere
- ⚠️ **There is no `X-Tenant` header.** The axios client injects only `Authorization` and `Accept-Language`. `getTenantSlug()` in `shared/lib/tenant.ts` reads `VITE_DEV_TENANT_SLUG` but **is never called from anywhere** — it is dead code
- ⚠️ Tenant resolution is broken end to end right now (see root `CLAUDE.md` divergences). Don't build tenant-dependent UI assuming isolation works until Faza 1.1 lands

## UI Components

- Use Shadcn/ui components from `src/shared/components/ui/` for all base UI
- Use `lucide-react` for icons
- Use `sonner` (`toast.success / toast.error`) for all notifications — no `alert()`
- Tailwind CSS only for styling — no inline styles, no CSS modules

## Environment Variables

```
VITE_API_URL=http://localhost:5199    # Vite proxy target for /api (dev only)
VITE_DEV_TENANT_SLUG=demo             # Read by getTenantSlug(), which nothing calls — currently inert
```

All env vars must be prefixed with `VITE_` to be accessible in the browser.

## Testing

**TDD is mandatory** — write the failing test first. See root `CLAUDE.md` and `documentation/STRATEGY.md`.

⚠️ **There is no test runner installed yet.** `package.json` has no test script and there are zero test files. Setting up Vitest + React Testing Library is Faza 2.8 — do that before writing the first frontend test rather than improvising a different framework.

`npm run lint` is also **broken**: ESLint 9 is installed but `eslint.config.js` does not exist, so the script fails on a migration error. This means `eslint-plugin-react-hooks` has never run over this codebase — expect latent hook violations. Creating the flat config is part of Faza 2.8.

Working checks today:

```bash
npm run build    # tsc -b && vite build — real type checking, used by CI
npm run dev      # dev server on :5173
```

## TypeScript Rules

- No `any` — use `unknown` and narrow, or define proper types
- API response types go in `features/{feature}/types/`
- Shared types (used across features) go in `shared/lib/types.ts`
- Prefer `interface` for object shapes, `type` for unions/intersections
