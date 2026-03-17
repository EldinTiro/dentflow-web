# DentFlow Web — Copilot Instructions

This is the **DentFlow frontend**: a React + TypeScript SPA for dental practice management.
Always apply every rule in this file. Never deviate without an explicit user instruction.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript 5 |
| Build | Vite |
| Routing | React Router v7 |
| Server state | TanStack Query v5 (`useQuery`, `useMutation`) |
| Forms | React Hook Form + Zod |
| HTTP | Axios (via `src/shared/api/client.ts`) |
| UI components | Shadcn/ui primitives + Tailwind CSS v4 |
| Global state | Zustand (auth only — `src/features/auth/store/authStore.ts`) |
| Toasts | Sonner (`toast.error(...)`, `toast.success(...)`) |

---

## Project Structure

```
src/
  App.tsx                        # Root — mounts <AppRouter> + <Toaster>
  main.tsx
  features/
    auth/                        # Login, JWT storage, auth store
    appointments/                # Appointment booking, list, calendar
    patients/                    # Patient management
    staff/                       # Staff profiles, availability, blocked times
  routes/                        # React Router route definitions
  shared/
    api/
      client.ts                  # Axios instance with JWT interceptor
    components/                  # Reusable UI (Drawer, Button, etc.)
    utils/
      apiError.ts                # Central API error extraction (see Error Handling)
    context/
      ThemeContext.tsx
```

---

## API Error Handling

### Wire Format
The backend (FastEndpoints) returns 4xx errors in this shape:
```json
{
  "status": 400,
  "errors": [
    { "name": "generalErrors", "reason": "This provider has a scheduled leave during the selected time." }
  ]
}
```
`name` is always `"generalErrors"` for business errors. `reason` carries the user-readable description.

### `getApiErrorMessage` — the only way to extract error text

**Always** use `getApiErrorMessage` from `@/shared/utils/apiError` to convert an Axios error to a string. Never access `error.response.data` directly in components.

```ts
import { getApiErrorMessage } from '@/shared/utils/apiError';

const mutation = useMutation({
  mutationFn: (data: BookAppointmentRequest) => appointmentService.book(data),
  onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); onClose(); },
  onError: (err: unknown) => {
    toast.error(getApiErrorMessage(err, 'Failed to book appointment. Please try again.'));
  },
});
```

Rules:
- `onError` parameter type is always `unknown` — never `Error` or `AxiosError`.
- Always pass a sensible fallback string as the second argument to `getApiErrorMessage`.
- `getApiErrorMessage` also contains a **safety-net map** (`ERROR_CODE_MESSAGES`) that converts known machine error codes (e.g. `"Appointment.ProviderUnavailable"`) to friendly messages, in case the backend ever sends a code instead of a description. When adding new `Error` types on the backend, **add a corresponding entry to `ERROR_CODE_MESSAGES`** in `src/shared/utils/apiError.ts`.

### Displaying Errors — use `toast.error`, never inline banners

- **Always** show API errors via `toast.error(message)`.
- **Never** use `setError('root', ...)` + `{errors.root && <div>...}` for server-side errors — this pattern was removed because it crashed React when an error object was accidentally rendered instead of a string.
- Field-level validation errors from React Hook Form (`errors.fieldName.message`) are still displayed inline next to the field — that is correct.

```tsx
// ✅ Correct
onError: (err: unknown) => {
  toast.error(getApiErrorMessage(err, 'Failed to save. Please try again.'));
},

// ❌ Wrong — crashes if API returns an object
onError: (err) => {
  setError('root', { message: err.response?.data?.errors[0] });
},

// ❌ Wrong — never access the raw error shape outside apiError.ts
onError: (err: AxiosError) => {
  setError('root', { message: err.response?.data?.errors?.[0]?.reason });
},
```

### Adding a new mutation

The complete pattern for any mutation that calls the API:

```tsx
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/shared/utils/apiError';

const mutation = useMutation({
  mutationFn: (data: SomeRequest) => someService.create(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['some-key'] });
    onClose(); // or whatever cleanup
    toast.success('Saved successfully.');  // optional success feedback
  },
  onError: (err: unknown) => {
    toast.error(getApiErrorMessage(err, 'Failed to save. Please try again.'));
  },
});
```

---

## Forms (Zod + React Hook Form)

### Schema-first approach

Define a Zod schema first, then derive the TypeScript type from it with `z.infer`. Never write the form type by hand.

```ts
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

const bookAppointmentSchema = z.object({
  patientId: z.string().uuid('Select a patient'),
  providerId: z.string().uuid('Select a provider'),
  startAt: z.string().min(1, 'Start time is required'),
  chiefComplaint: z.string().max(500).optional(),
})
type BookAppointmentFormValues = z.infer<typeof bookAppointmentSchema>

// In component:
const { register, handleSubmit, formState: { errors, isSubmitting } } =
  useForm<BookAppointmentFormValues>({ resolver: zodResolver(bookAppointmentSchema) })
```

Rules:
- Mark optional fields with `.optional()` on the schema, not by making the type property optional with `?`.
- For optional text inputs that can be blank, use `z.string().optional().or(z.literal(''))`.
- Always use `zodResolver` — never use manual validation functions in `useForm`.
- Derive the type: `type FormValues = z.infer<typeof schema>` — no separate type declaration.

### Disabling the submit button during async work

Always disable the submit button when the mutation is pending or the form is submitting:

```tsx
const mutation = useMutation({ ... })

<button type="submit" disabled={mutation.isPending}>
  {mutation.isPending ? 'Saving…' : 'Save'}
</button>

// Or when using form-level isSubmitting (auth forms, no mutation):
<button type="submit" disabled={isSubmitting}>
  {isSubmitting ? 'Signing in…' : 'Sign in'}
</button>
```

### Field-level errors

Show React Hook Form field errors inline beneath each input. Keep these separate from API toast errors:

```tsx
<input {...register('email')} />
{errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
```

---

## Architecture Rules

### Features
- Each feature lives under `src/features/<name>/`.
- Sub-folders: `components/`, `pages/`, `services/`, `hooks/` (optional).
- No feature imports from another feature directly — use shared utilities only.

### Services (`<feature>/services/<name>Service.ts`)
- One file per domain area.
- Each method returns a `Promise<T>` by calling `apiClient.get/post/put/delete(...).then(r => r.data)`.
- All request and response types are defined and exported from the same service file.
- No business logic in services — only HTTP calls.

### Components
- Prefer function components with named exports.
- Use React Hook Form for all forms — never raw `useState` for form fields.
- Keep components focused: if a component exceeds ~200 lines, split it.

### State Management
- **Server state**: TanStack Query only — `useQuery` for reads, `useMutation` for writes.
- **Global client state**: Zustand, only for auth (`accessToken`, `user`, `clearAuth`).
- **Local UI state**: `useState` / `useReducer` inside the component.
- Never put server data into Zustand.

### Toaster
`<Toaster position="top-right" richColors closeButton />` is mounted once in `App.tsx`.
Never mount additional `<Toaster>` instances.

### Query Keys

Use array-based query keys with a feature prefix followed by any discriminators. Keep them consistent between reads and invalidations.

| Pattern | Example key |
|---|---|
| Parameterless list | `['appointment-types']` |
| List with filters/params | `['appointments', params]` |
| Single item by id | `['patients', id]` |
| Nested resource list | `['staff', staffId, 'availability']` |

```tsx
// Reading
const { data } = useQuery({
  queryKey: ['appointments', params],
  queryFn: () => appointmentService.list(params),
})

// After mutation succeeds, invalidate by prefix to refetch all related queries
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['appointments'] })
}
```

Rules:
- Get `queryClient` from `useQueryClient()` — never import it directly from `@tanstack/react-query`.
- Always invalidate by the top-level prefix, not the full key with params, so all list variants are refreshed.
- Keep query key arrays in the service file or a dedicated `queryKeys.ts` file — never inline magic strings scattered across components.

### Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Component files | PascalCase | `BookAppointmentDrawer.tsx` |
| Page components | PascalCase + `Page` suffix | `AppointmentsPage.tsx` |
| Custom hooks | camelCase + `use` prefix | `useStaffList.ts` |
| Service files | camelCase + `Service` suffix | `appointmentService.ts` |
| Utility files | camelCase | `apiError.ts` |
| Zod schemas | camelCase + `Schema` suffix | `bookAppointmentSchema` |
| Form value types | PascalCase + `FormValues` suffix | `BookAppointmentFormValues` |
| Query key arrays | camelCase noun matching feature | `['appointments', ...]` |

### Routing

All routes are defined in `src/routes/index.tsx`. **Do not define routes elsewhere.**

- Wrap all authenticated routes in `<ProtectedRoute>` — it redirects to `/login` when the user is not authenticated.
- Wrap role-restricted areas in `<RoleGuard allowedRoles={[...]} />`.
- Navigate programmatically with `useNavigate()` — never use `window.location.href`.
- Use `<Link to="...">` for declarative navigation, never `<a href>` for in-app links.
- Add new pages to the route tree in `index.tsx`; create a matching `Page` component under the feature's `pages/` folder.

---

## TypeScript Conventions

- Use `type` for API response/request shapes, union types, and computed types.
- Use `interface` for React component props.
- Never use `any` — use `unknown` for untyped values and narrow with type guards.
- For optional API response fields that can be absent, use `field: string | null` (matching JSON `null`), not `field?: string` (which implies `undefined`). The two are distinct in TypeScript.
- Prefer type inference (`const x = expr`) over explicit annotations where the type is obvious.
- Use `as const` for fixed string unions rather than `enum`:
  ```ts
  // ✅
  export const STATUSES = ['Scheduled', 'Confirmed', 'Cancelled'] as const
  export type Status = typeof STATUSES[number]

  // ❌
  enum Status { Scheduled, Confirmed, Cancelled }
  ```
- When the type of `err` is `unknown` (all `onError` callbacks), cast via the existing `AxiosError` wrapper inside `getApiErrorMessage` — do not cast to `any` in call sites.
- Enable strict mode — `tsconfig.app.json` already has `"strict": true`. Do not weaken it.

---

## What NOT to Do

- Do not access `error.response.data` directly in components — use `getApiErrorMessage`.
- Do not use `setError('root', ...)` for API-level errors — use `toast.error(...)`.
- Do not render error objects as React children — always extract the string first.
- Do not add a second `<Toaster>` — one is already in `App.tsx`.
- Do not use `axios` directly in components — always go through the service layer.
- Do not store server-fetched data in Zustand — use TanStack Query cache.
- Do not use `any` — use `unknown` for untyped errors and narrow with type guards.
- Do not use AutoMapper equivalents or class-transformer — map types manually.
- Do not write form types by hand — always derive with `z.infer<typeof schema>`.
- Do not leave submit buttons enabled while a mutation is pending — always set `disabled={mutation.isPending}`.
- Do not define routes outside `src/routes/index.tsx`.
- Do not use `window.location.href` for in-app navigation — use `useNavigate()`.
- Do not use plain `enum` — use `as const` string arrays instead.
- Do not invalidate with a full param-qualified query key after a mutation — invalidate by the top-level prefix so all list variants refresh.
