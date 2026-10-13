// src/components/dev/AvailabilityDiagnostic.tsx

import { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui'
import { useToast } from '../ui/Toast'
import { useBusiness } from '../../contexts/BusinessContext'
import { http } from '../../api/http'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CallResult {
  id: string
  method: 'GET'
  url: string
  status: number | null
  durationMs: number | null
  ok: boolean
  body: unknown
  error?: string
}

interface CallSpec {
  id: string
  label: string
  url: string
  hint?: string
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AvailabilityDiagnostic() {
  const toast = useToast()
  const { activeBusinessId } = useBusiness()

  // ── Inputs — seeded with the values from your failing session ───────
  const [branchId, setBranchId] = useState('0c1077fb-5bfd-4935-aa19-81c7109b1f44')
  const [knownBranchId, setKnownBranchId] = useState(
    'baa68e82-ff6e-4ddb-a4f9-5cf84d07f0f0',
  )
  const [serviceA, setServiceA] = useState('720fc125-cde4-48a2-a3d6-17b1b9deacba')
  const [serviceB, setServiceB] = useState('d36f3efb-e39b-4a87-b52c-295564704c45')
  const [staffId, setStaffId] = useState('a54a2b66-9e54-4233-ae36-a4ebd32bff61')
  const [date, setDate] = useState('2026-09-25')

  const [results, setResults] = useState<CallResult[]>([])
  const [running, setRunning] = useState(false)

  // ── Build the call list from the inputs ────────────────────────────
  const calls = useMemo<CallSpec[]>(() => {
    if (!activeBusinessId) return []
    const B = activeBusinessId
    return [
      // Sanity
      { id: 'me', label: 'auth/me', url: `/auth/me` },

      // Branches list — tells us whether the modal's branch exists
      {
        id: 'branches',
        label: 'branches list',
        url: `/businesses/${B}/branches`,
        hint: 'Every branch the caller can see. If the modal branch is missing here, it is stale.',
      },

      // Weekly hours — the modal's branch and a known-good one
      {
        id: 'hours-modal',
        label: `weekly hours — modal branch (${branchId.slice(0, 8)}…)`,
        url: `/${B}/branches/${branchId}/weekly-hours`,
        hint: 'Empty array = no hours configured. The UI falls back to defaults, but the server treats it as closed.',
      },
      {
        id: 'hours-known',
        label: `weekly hours — known branch (${knownBranchId.slice(0, 8)}…)`,
        url: `/${B}/branches/${knownBranchId}/weekly-hours`,
      },

      // Operating intervals — the merged hours for the picked date
      {
        id: 'intervals-modal',
        label: `operating intervals — modal branch · ${date}`,
        url: `/businesses/${B}/branches/${branchId}/operating-intervals?date=${date}`,
        hint: 'Empty intervals = closed that day.',
      },
      {
        id: 'intervals-known',
        label: `operating intervals — known branch · ${date}`,
        url: `/businesses/${B}/branches/${knownBranchId}/operating-intervals?date=${date}`,
      },

      // Availability — every branch/service/staff combo
      {
        id: 'avail-modal-A',
        label: `availability — modal + service A`,
        url: `/businesses/${B}/availability?branchId=${branchId}&serviceId=${serviceA}&date=${date}&source=INTERNAL`,
      },
      {
        id: 'avail-modal-A-staff',
        label: `availability — modal + service A + staff`,
        url: `/businesses/${B}/availability?branchId=${branchId}&serviceId=${serviceA}&date=${date}&staffId=${staffId}&source=INTERNAL`,
      },
      {
        id: 'avail-modal-B',
        label: `availability — modal + service B`,
        url: `/businesses/${B}/availability?branchId=${branchId}&serviceId=${serviceB}&date=${date}&source=INTERNAL`,
      },
      {
        id: 'avail-known-A',
        label: `availability — known + service A`,
        url: `/businesses/${B}/availability?branchId=${knownBranchId}&serviceId=${serviceA}&date=${date}&source=INTERNAL`,
      },
      {
        id: 'avail-known-B',
        label: `availability — known + service B`,
        url: `/businesses/${B}/availability?branchId=${knownBranchId}&serviceId=${serviceB}&date=${date}&source=INTERNAL`,
      },

      // Staff detail — did the service qualification come through?
      {
        id: 'staff',
        label: 'staff detail (service qualifications)',
        url: `/staff/${staffId}`,
      },

      // Services — do they have branch assignments?
      {
        id: 'services',
        label: 'services list (branch assignments)',
        url: `/businesses/${B}/services`,
      },
    ]
  }, [activeBusinessId, branchId, knownBranchId, serviceA, serviceB, staffId, date])

  // ── Runner ─────────────────────────────────────────────────────────
  async function runAll() {
    setRunning(true)
    setResults([])

    const out: CallResult[] = []
    for (const c of calls) {
      const started = performance.now()
      try {
        const raw = await rawFetch(c.url)
        const durationMs = Math.round(performance.now() - started)
        out.push({
          id: c.id,
          method: 'GET',
          url: c.url,
          status: raw.status,
          durationMs,
          ok: raw.status >= 200 && raw.status < 300,
          body: raw.body,
        })
      } catch (err: any) {
        out.push({
          id: c.id,
          method: 'GET',
          url: c.url,
          status: null,
          durationMs: Math.round(performance.now() - started),
          ok: false,
          body: null,
          error: err?.message ?? String(err),
        })
      }
      setResults([...out])
    }

    setRunning(false)
    toast.success('Diagnostic complete')
  }

  const byId = useMemo(() => {
    const m = new Map<string, CallResult>()
    for (const r of results) m.set(r.id, r)
    return m
  }, [results])

  if (!activeBusinessId) {
    return (
      <div className="p-8">
        <p className="text-sm text-ink-3">No active business selected.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 lg:px-8 py-5 bg-surface border-b border-line flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[1.75rem] text-ink leading-none">
              Availability diagnostic
            </h2>
            <p className="text-ink-3 text-sm mt-1.5">
              Runs the same calls the New Booking modal uses and shows the raw
              responses. Nothing is mutated on the server.
            </p>
          </div>
          <Button size="sm" onClick={() => void runAll()} loading={running}>
            {running ? 'Running…' : 'Run diagnostic'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6 flex flex-col gap-6">

        {/* Inputs */}
        <Section title="Inputs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5">
            <Field label="businessId (from context)" value={activeBusinessId} readOnly />
            <Field label="branchId (modal)" value={branchId} onChange={setBranchId} />
            <Field label="branchId (known-good)" value={knownBranchId} onChange={setKnownBranchId} />
            <Field label="serviceId A" value={serviceA} onChange={setServiceA} />
            <Field label="serviceId B" value={serviceB} onChange={setServiceB} />
            <Field label="staffId" value={staffId} onChange={setStaffId} />
            <Field label="date (YYYY-MM-DD)" value={date} onChange={setDate} />
          </div>
        </Section>

        {/* Summary — the answers, at a glance */}
        {results.length > 0 && (
          <Section
            title="Summary"
            hint="These conclusions are derived from the responses below."
          >
            <div className="p-5 flex flex-col gap-2 text-sm">
              <SummaryLine
                ok={Boolean(branchExists(byId.get('branches')?.body, branchId))}
                okText="Modal branch exists in the branches list"
                failText="Modal branch is NOT in the branches list → stale id. Reset the modal to a valid branch."
              />
              <SummaryLine
                ok={
                  branchExists(byId.get('branches')?.body, branchId) === false
                    ? false
                    : Boolean(
                        nonEmpty(
                          byId.get('hours-modal')?.body,
                          (r: any) => r?.data,
                        ),
                      )
                }
                okText="Modal branch has weekly hours configured"
                failText="Modal branch has no weekly hours → the branch is effectively closed every day. Set hours in Branches → hours."
              />
              <SummaryLine
                ok={Boolean(
                  nonEmpty(
                    byId.get('intervals-modal')?.body,
                    (r: any) => r?.data?.intervals,
                  ),
                )}
                okText={`Branch is open on ${date}`}
                failText={`Branch is closed on ${date} → pick another date or fix the override.`}
              />
              <SummaryLine
                ok={Boolean(
                  nonEmpty(
                    byId.get('avail-modal-A')?.body,
                    (r: any) => r?.data?.availableSlots,
                  ),
                )}
                okText="Service A has slots at the modal branch"
                failText="Service A has no slots at the modal branch → service not assigned, staff not qualified, or fully booked."
              />
              <SummaryLine
                ok={Boolean(
                  nonEmpty(
                    byId.get('avail-known-A')?.body,
                    (r: any) => r?.data?.availableSlots,
                  ),
                )}
                okText="Service A has slots at the known-good branch"
                failText="Service A has no slots anywhere → server-side issue with this service or date."
              />
            </div>
          </Section>
        )}

        {/* Raw responses */}
        {calls.map(c => {
          const r = byId.get(c.id)
          return (
            <Section key={c.id} title={c.label} hint={c.hint}>
              <div className="p-5 flex flex-col gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusChip result={r} />
                  <code className="text-[11px] font-mono text-ink-2 break-all">
                    GET {c.url}
                  </code>
                </div>

                {/* Specialized summaries per call */}
                {c.id === 'branches' && r?.body !== undefined && (
                  <BranchListSummary body={r.body} modalBranchId={branchId} />
                )}
                {c.id.startsWith('hours-') && r?.body !== undefined && (
                  <WeeklyHoursSummary body={r.body} />
                )}
                {c.id.startsWith('intervals-') && r?.body !== undefined && (
                  <IntervalsSummary body={r.body} />
                )}
                {c.id.startsWith('avail-') && r?.body !== undefined && (
                  <AvailabilitySummary body={r.body} />
                )}
                {c.id === 'staff' && r?.body !== undefined && (
                  <StaffSummary body={r.body} />
                )}
                {c.id === 'services' && r?.body !== undefined && (
                  <ServicesSummary
                    body={r.body}
                    serviceIds={[serviceA, serviceB]}
                    branchIds={[branchId, knownBranchId]}
                  />
                )}

                {r?.error && (
                  <p className="text-xs text-[#B03A3A]">{r.error}</p>
                )}

                <JsonBlock label="raw" data={r?.body} />
              </div>
            </Section>
          )
        })}

        {results.length === 0 && !running && (
          <div className="bg-surface rounded-2xl border border-line px-5 py-10 text-center">
            <p className="text-sm text-ink-2 font-medium mb-1">
              Nothing run yet
            </p>
            <p className="text-xs text-ink-3">
              Click <span className="text-ink">Run diagnostic</span> above to
              issue the calls.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Layout helpers                                                     */
/* ------------------------------------------------------------------ */

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {hint && <p className="text-[11px] text-ink-3">{hint}</p>}
      </div>
      <div className="bg-surface rounded-2xl border border-line">{children}</div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-ink-3">{label}</span>
      <input
        type="text"
        value={value}
        readOnly={readOnly}
        onChange={e => onChange?.(e.target.value)}
        className={`h-9 px-2.5 rounded-lg border text-xs font-mono
          ${
            readOnly
              ? 'bg-bg text-ink-3 border-line'
              : 'bg-surface text-ink border-line focus:outline-none focus:border-ink-3'
          }`}
      />
    </label>
  )
}

function StatusChip({ result }: { result?: CallResult }) {
  if (!result) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-ink-3 font-medium">
        not run
      </span>
    )
  }
  const color = !result.ok
    ? 'bg-[#FBEDED] text-[#B03A3A]'
    : result.status && result.status >= 200 && result.status < 300
      ? 'bg-[#EAF5EC] text-[#2A5F30]'
      : 'bg-[#FBF5EA] text-[#7A5F2C]'
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${color}`}>
      {result.status ?? 'ERR'} · {result.durationMs ?? '—'}ms
    </span>
  )
}

function SummaryLine({
  ok,
  okText,
  failText,
}: {
  ok: boolean
  okText: string
  failText: string
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={`text-[10px] mt-0.5 px-1.5 py-0.5 rounded ${
          ok ? 'bg-[#EAF5EC] text-[#2A5F30]' : 'bg-[#FBEDED] text-[#B03A3A]'
        }`}
      >
        {ok ? 'OK' : 'FAIL'}
      </span>
      <span className={ok ? 'text-ink-2' : 'text-ink'}>
        {ok ? okText : failText}
      </span>
    </div>
  )
}

function JsonBlock({ label, data }: { label: string; data: unknown }) {
  const toast = useToast()
  const text = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }, [data])
  if (data == null) return null
  const truncated = text.length > 4000
  const shown = truncated ? text.slice(0, 4000) + '\n… (truncated)' : text

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-ink-3 uppercase tracking-wider">
          {label}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="text-[10px] text-ink-3 hover:text-ink"
        >
          Copy
        </button>
      </div>
      <pre className="text-[11px] font-mono text-ink-2 whitespace-pre-wrap break-all bg-bg rounded-lg px-3 py-2 max-h-72 overflow-y-auto">
        {shown}
      </pre>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Specialized summaries                                              */
/* ------------------------------------------------------------------ */

function BranchListSummary({
  body,
  modalBranchId,
}: {
  body: unknown
  modalBranchId: string
}): React.ReactNode {
  const data = (body as any)?.data ?? body ?? []
  if (!Array.isArray(data)) return null
  const ids = data.map((b: any) => b.id)
  const present = ids.includes(modalBranchId)
  return (
    <div
      className={`text-xs rounded-lg px-3 py-2 ${
        present
          ? 'bg-[#EAF5EC] text-[#2A5F30]'
          : 'bg-[#FBEDED] text-[#B03A3A]'
      }`}
    >
      {present
        ? `Modal branch found among the ${ids.length} branches.`
        : `Modal branch NOT among the ${ids.length} branches — the id is stale.`}
    </div>
  )
}

function WeeklyHoursSummary({ body }: { body: unknown }): React.ReactNode {
  const data = (body as any)?.data ?? body ?? []
  if (!Array.isArray(data)) return null
  if (data.length === 0) {
    return (
      <div className="text-xs rounded-lg px-3 py-2 bg-[#FBEDED] text-[#B03A3A]">
        No weekly hours configured — the branch is treated as closed every day.
        Set hours in Branches → hours.
      </div>
    )
  }
  const open = data.filter((r: any) => !r.isClosed)
  const openDays = open
    .map((r: any) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][r.dayOfWeek])
    .join(', ')
  return (
    <div className="text-xs rounded-lg px-3 py-2 bg-[#EAF5EC] text-[#2A5F30]">
      {data.length} day{data.length === 1 ? '' : 's'} configured ·{' '}
      {open.length} open ({openDays || 'none'}).
    </div>
  )
}

function IntervalsSummary({ body }: { body: unknown }): React.ReactNode {
  const intervals = (body as any)?.data?.intervals ?? (body as any)?.intervals
  if (!Array.isArray(intervals)) return null
  if (intervals.length === 0) {
    return (
      <div className="text-xs rounded-lg px-3 py-2 bg-[#FBEDED] text-[#B03A3A]">
        No operating intervals — branch is closed on this date.
      </div>
    )
  }
  const intervalText = intervals
    .map((i: any) => `${i.start.slice(11, 16)}–${i.end.slice(11, 16)}`)
    .join(', ')
  return (
    <div className="text-xs rounded-lg px-3 py-2 bg-[#EAF5EC] text-[#2A5F30]">
      {intervals.length} interval{intervals.length === 1 ? '' : 's'}: {intervalText}
    </div>
  )
}

function AvailabilitySummary({ body }: { body: unknown }): React.ReactNode {
  const slots = (body as any)?.data?.availableSlots ?? (body as any)?.availableSlots
  if (!Array.isArray(slots)) return null
  if (slots.length === 0) {
    return (
      <div className="text-xs rounded-lg px-3 py-2 bg-[#FBF5EA] text-[#7A5F2C]">
        No slots returned. Likely causes: branch closed, service not assigned,
        staff not qualified, all staff booked, or date outside the advance window.
      </div>
    )
  }
  const slotText = slots.slice(0, 6).map((s: any) => s.startTime.slice(11, 16)).join(', ')
  return (
    <div className="text-xs rounded-lg px-3 py-2 bg-[#EAF5EC] text-[#2A5F30]">
      {slots.length} slot{slots.length === 1 ? '' : 's'} available: {slotText}
      {slots.length > 6 ? `… +${slots.length - 6}` : ''}
    </div>
  )
}

function StaffSummary({ body }: { body: unknown }): React.ReactNode {
  const staff = (body as any)?.data ?? body
  if (!staff) return null
  const quals = Array.isArray(staff.serviceQualifications)
    ? staff.serviceQualifications.filter((q: any) => q.isActive)
    : []
  const qualNames = quals.map((q: any) => q.service?.name ?? q.serviceId).join(', ')
  return (
    <div className="text-xs rounded-lg px-3 py-2 bg-bg text-ink-2">
      {staff.firstName} {staff.lastName} · branchId {staff.branchId} ·{' '}
      {quals.length} active service qualification{quals.length === 1 ? '' : 's'}
      {quals.length > 0 && ` (${qualNames})`}
    </div>
  )
}

function ServicesSummary({
  body,
  serviceIds,
  branchIds,
}: {
  body: unknown
  serviceIds: string[]
  branchIds: string[]
}): React.ReactNode {
  const list = (body as any)?.data ?? body
  if (!Array.isArray(list)) return null
  const byId = new Map(list.map((s: any) => [s.id, s]))
  return (
    <div className="text-xs rounded-lg px-3 py-2 bg-bg text-ink-2 flex flex-col gap-1">
      {serviceIds.map(id => {
        const svc = byId.get(id)
        if (!svc) {
          return (
            <span key={id}>
              Service {id.slice(0, 8)}… not found in list.
            </span>
          )
        }
        const assigns = (svc.branchAssignments ?? [])
          .filter((a: any) => a.isActive)
          .map((a: any) => a.branchId)
        const matches = branchIds.some(b => assigns.includes(b))
        const assignText =
          assigns.length === 0
            ? 'no active branches'
            : assigns
                .map((bid: string) =>
                  branchIds.includes(bid)
                    ? `<one of ours: ${bid.slice(0, 8)}…>`
                    : bid.slice(0, 8) + '…',
                )
                .join(', ')
        return (
          <span key={id}>
            <span className="font-medium text-ink">{svc.name}</span> — assigned to {assignText}
            {!matches && (
              <span className="text-[#B03A3A]">
                {' '}— not assigned to any of the tested branches
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Raw fetch (no envelope unwrapping — we want the status)            */
/* ------------------------------------------------------------------ */

const API_PREFIX = '/api/v1'   // matches your Vite proxy

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  const keys = [
    'zsalon.accessToken',
    'accessToken',
    'token',
    'authToken',
    'zsalon.token',
  ]
  for (const k of keys) {
    const v = localStorage.getItem(k)
    if (v && v.length > 20) return v.replace(/^"|"$/g, '')
  }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k) continue
    const v = localStorage.getItem(k)
    if (typeof v === 'string' && v.split('.').length === 3 && v.length > 100) {
      return v.replace(/^"|"$/g, '')
    }
  }
  return null
}

async function rawFetch(
  path: string,
): Promise<{ status: number; body: unknown }> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_PREFIX}${path}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  })

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { status: res.status, body }
}

/* ------------------------------------------------------------------ */
/*  Summary helpers                                                    */
/* ------------------------------------------------------------------ */

function branchExists(body: unknown, branchId: string): boolean | null {
  const data = (body as any)?.data ?? body
  if (!Array.isArray(data)) return null
  return data.some((b: any) => b?.id === branchId)
}

function nonEmpty(
  body: unknown,
  pick: (b: any) => unknown,
): boolean | null {
  if (body == null) return null
  const val = pick(body)
  if (!Array.isArray(val)) return null
  return val.length > 0
}