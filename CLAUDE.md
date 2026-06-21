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
  apiClient.get<PatientResponse>(`/patients/${id}`).then(r => r.data);
```

- `Authorization: Bearer {token}` is injected automatically by the interceptor
- On 401: interceptor calls `/api/v1/auth/refresh` automatically, then retries the original request
- On refresh failure: user is redirected to `/login` — no manual handling needed
- Base URL is `VITE_API_URL` + `/api/v1`

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

const { user, token, setToken, logout } = useAuthStore();
```

- Access token lives only in Zustand (memory) — never in `localStorage` or `sessionStorage`
- Refresh token is in an HttpOnly cookie — never accessible from JS
- Use `useAuthStore` to read current user role for conditional rendering

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

- In dev: tenant slug sent via `X-Tenant` header, controlled by `VITE_DEV_TENANT_SLUG` env var
- In prod: resolved by subdomain — frontend does not manage this
- The Axios client handles tenant header injection automatically in dev mode
- Never hardcode tenant IDs anywhere

## UI Components

- Use Shadcn/ui components from `src/shared/components/ui/` for all base UI
- Use `lucide-react` for icons
- Use `sonner` (`toast.success / toast.error`) for all notifications — no `alert()`
- Tailwind CSS only for styling — no inline styles, no CSS modules

## Environment Variables

```
VITE_API_URL=http://localhost:5199    # Backend base URL
VITE_DEV_TENANT_SLUG=demo            # Tenant slug injected as header in dev
```

All env vars must be prefixed with `VITE_` to be accessible in the browser.

## TypeScript Rules

- No `any` — use `unknown` and narrow, or define proper types
- API response types go in `features/{feature}/types/`
- Shared types (used across features) go in `shared/lib/types.ts`
- Prefer `interface` for object shapes, `type` for unions/intersections
