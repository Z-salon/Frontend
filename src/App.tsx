// src/App.tsx

import { useEffect, useMemo, useRef, useState } from "react"
import type {
  AuthScreen as AuthScreenType,
  NavSection,
  FeedbackItem,
  Transaction,
  ExpenseCategory,
  PaymentMethod,
  AppSettings,
} from "./types"
import type {
  Appointment,
  AppointmentStaffRef,
  Branch,
  Customer,
  Service,
  ServiceCategory,
  Staff as StaffMember,
  StaffDetail,
} from "./types/api"
import { useAuth } from "./hooks/useAuth"
import { useBusiness } from "./contexts/BusinessContext"
import { useBranch } from "./contexts/BranchContext"
import { isNetworkError } from "./api/errors"
import { servicesApi } from "./api/services.api"
import { serviceCategoriesApi } from "./api/service-categories.api"
import { staffApi } from "./api/staff.api"
import { branchesApi } from "./api/branches.api"
import { customersApi } from "./api/customers.api"
import { appointmentsApi } from "./api/appointments.api"
import { useToast } from "./components/ui/Toast"
import { AuthScreen } from "./components/auth/Auth"
import { OnboardingWizard } from "./components/onboarding/Onboarding"
import { AppShell } from "./components/layout/Shell"
import { BookingDashboard } from "./components/bookings/Dashboard"
import { AppointmentPanel } from "./components/bookings/AppointmentPanel"
import { NewBookingModal, WalkInModal } from "./components/bookings/Modals"
import { ServicesPage } from "./components/services/ServicesPage"
import { StaffPage } from "./components/staff/StaffPage"
import { BranchesPage } from "./components/branches/BranchesPage"
import { CustomersPage } from "./components/customers/CustomersPage"
import { FeedbackPage } from "./components/feedback/FeedbackPage"
import { FinancePage } from "./components/finance/FinancePage"
import { DashboardPage } from "./components/dashboard/DashboardPage"
import { SettingsPage } from "./components/settings/SettingsPage"
import {
  initialFeedback,
  initialTransactions,
  expenseCategories as initialExpCats,
  paymentMethods as initialPayMethods,
  defaultAppSettings,
} from "./data/mock"

/* ------------------------------------------------------------------ */
/*  Onboarding helper                                                  */
/* ------------------------------------------------------------------ */

function onboardingKey(userId: string): string {
  return `zsalon.onboardingComplete.${userId}`
}

function BootScreen() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-3">
      <h1 className="font-display text-[2rem] text-ink leading-none tracking-tight">
        Z-salon
      </h1>
      <p className="text-warm font-display italic text-xl">ዘsalon</p>
      <svg
        className="animate-spin text-ink-3 mt-1"
        width="20" height="20" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 11-6.219-8.56" />
      </svg>
    </div>
  )
}

/**
 * Normalize an appointment's staff reference. The payload sends a single
 * object with an `id` field (see types/api.ts). Older serializers or
 * transitional clients may shape it as an array with `staffId`, so we
 * tolerate both here — one helper, used by every consumer below.
 */
function appointmentStaff(
  a: Appointment | null | undefined,
): AppointmentStaffRef | null {
  if (!a) return null
  const raw = a.staff as unknown
  if (!raw) return null
  if (Array.isArray(raw)) {
    return ((raw[0] as AppointmentStaffRef) ?? null)
  }
  return raw as AppointmentStaffRef
}

export default function App() {
  /* ── Auth + business + branch context ────────────────────────────── */
  const { status, user, logout } = useAuth()
  const { activeBusinessId, isAdminOrOwner } = useBusiness()
  const { activeBranchFilter } = useBranch()
  const toast = useToast()

  /* ── Auth flow state ─────────────────────────────────────────────── */
  const [authScreen, setAuthScreen] = useState<AuthScreenType>("login")
  const [navSection, setNavSection] = useState<NavSection>("dashboard")
  const [pendingPhone, setPendingPhone] = useState<string>("")

  /* ── Onboarding gate ─────────────────────────────────────────────── */
  const [onboarded, setOnboarded] = useState<boolean>(false)
  const [setupResolved, setSetupResolved] = useState<boolean>(false)
  const previousUserId = useRef<string | null>(null)

  useEffect(() => {
    const id = user?.id ?? null
    if (previousUserId.current !== id) {
      previousUserId.current = id
      setOnboarded(false)
      setSetupResolved(false)
    }
  }, [user])

  useEffect(() => {
    if (status !== "authenticated" || setupResolved) return
    if (!user) return

    const key = onboardingKey(user.id)

    if (localStorage.getItem(key) === "1") {
      setOnboarded(true)
      setSetupResolved(true)
      return
    }

    if (!isAdminOrOwner) {
      localStorage.setItem(key, "1")
      setOnboarded(true)
      setSetupResolved(true)
      return
    }

    if (!activeBusinessId) return

    let cancelled = false
    ;(async () => {
      try {
        const services = await servicesApi.list(activeBusinessId)
        if (cancelled) return
        const list = normalizeArray<Service>(services)
        if (list.length > 0) {
          localStorage.setItem(key, "1")
          setOnboarded(true)
        }
      } catch (err) {
        if (isNetworkError(err)) toast.error("Network Error")
      } finally {
        if (!cancelled) setSetupResolved(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [status, setupResolved, user, isAdminOrOwner, activeBusinessId])

  /* ── App data ────────────────────────────────────────────────────── */
  //
  // Migrated slices: appointments, services, categories, staff
  // (+ details), branches, customers. Still mock: feedback,
  // transactions, expense categories, payment methods, settings.

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [staffDetails, setStaffDetails] = useState<Map<string, StaffDetail>>(
    () => new Map(),
  )
  const [branches, setBranches] = useState<Branch[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  const [apptLoading, setApptLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  void apptLoading
  void dataLoading

  const [feedback, setFeedback] = useState<FeedbackItem[]>(initialFeedback)
  const [transactions, setTransactions] =
    useState<Transaction[]>(initialTransactions)
  const [expCats, setExpCats] = useState<ExpenseCategory[]>(initialExpCats)
  const [payMethods, setPayMethods] =
    useState<PaymentMethod[]>(initialPayMethods)
  const [appSettings, setAppSettings] =
    useState<AppSettings>(defaultAppSettings)

  /* ── Selected appointment + modals ───────────────────────────────── */
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [showNewBooking, setShowNewBooking] = useState(false)
  const [showWalkIn, setShowWalkIn] = useState(false)

  /* ── Appointments fetch ──────────────────────────────────────────── */
  useEffect(() => {
    if (!activeBusinessId) {
      setAppointments([])
      return
    }

    let cancelled = false
    setApptLoading(true)

    ;(async () => {
      try {
        const res = await appointmentsApi.list(activeBusinessId, {
          limit: 100,
        })
        if (cancelled) return
        setAppointments(normalizeArray<Appointment>(res))
      } catch (err) {
        if (cancelled) return
        console.error("[app] appointments load failed", err)
        toast.error(extractErrorMessage(err, "Could not load appointments."))
      } finally {
        if (!cancelled) setApptLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeBusinessId])

  /* ── Support slices fetch ────────────────────────────────────────── */
  //
  // services + categories + staff (+ each staff's detail for qualification
  // filtering) + branches + customers. One Promise.all for the list calls,
  // then a second parallel batch for the staff details (which are per-id).
  useEffect(() => {
    if (!activeBusinessId) {
      setServices([])
      setCategories([])
      setStaffList([])
      setStaffDetails(new Map())
      setBranches([])
      setCustomers([])
      return
    }

    let cancelled = false
    setDataLoading(true)

    ;(async () => {
      try {
        const [svcRes, catRes, staffRes, brRes, custRes] = await Promise.all([
          servicesApi.list(activeBusinessId),
          serviceCategoriesApi.list(activeBusinessId),
          staffApi.list(activeBusinessId),
          branchesApi.list(activeBusinessId),
          customersApi.list(activeBusinessId, { limit: 100 }),
        ])
        if (cancelled) return

        const staffMembers = normalizeArray<StaffMember>(staffRes)
        setServices(normalizeArray<Service>(svcRes))
        setCategories(normalizeArray<ServiceCategory>(catRes))
        setStaffList(staffMembers)
        setBranches(
          normalizeArray<Branch>(brRes).filter(b => b.isActive),
        )
        setCustomers(normalizeArray<Customer>(custRes))

        // Fetch each staff member's detail row (has serviceQualifications
        // / categoryQualifications). Fails soft — a single failure doesn't
        // blank the whole map, we just fall back to "unknown qualification"
        // for that staff member.
        const detailResults = await Promise.all(
          staffMembers.map(s =>
            staffApi.get(s.id).catch(err => {
              console.warn("[app] staff detail failed", s.id, err)
              return null
            }),
          ),
        )
        if (cancelled) return

        const map = new Map<string, StaffDetail>()
        for (const d of detailResults) {
          if (d) map.set(d.id, d)
        }
        setStaffDetails(map)
      } catch (err) {
        if (cancelled) return
        console.error("[app] support data load failed", err)
        toast.error(extractErrorMessage(err, "Could not load business data."))
      } finally {
        if (!cancelled) setDataLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeBusinessId])

  /* ── Branch lookup for the panel timezone ────────────────────────── */
  const selectedBranch = useMemo(
    () => branches.find(b => b.id === selectedAppt?.branchId) ?? null,
    [branches, selectedAppt?.branchId],
  )

  /* ── Resolved display data for the selected appointment ──────────── */
  //
  // The list endpoint already joins `customer` onto each appointment, so
  // we prefer that. Falling back to a lookup in the `customers` array keeps
  // things working if the payload ever drops the join.
  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedAppt?.customerId) ?? null,
    [customers, selectedAppt?.customerId],
  )

  const selectedCustomerName = useMemo(() => {
    // Prefer the joined customer on the appointment payload.
    const joined = selectedAppt?.customer
    if (joined) {
      const name = `${joined.firstName ?? ""} ${joined.lastName ?? ""}`.trim()
      if (name) return name
    }
    if (!selectedCustomer) return undefined
    return `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim()
  }, [selectedAppt?.customer, selectedCustomer])

  const selectedCustomerPhone = useMemo(() => {
    // Prefer the joined phones.
    const joinedPhones = selectedAppt?.customer?.phones ?? []
    const joinedPrimary =
      joinedPhones.find(p => p.isPrimary) ?? joinedPhones[0]
    if (joinedPrimary?.phone) return joinedPrimary.phone

    const phones = selectedCustomer?.phones ?? []
    const primary = phones.find(p => p.isPrimary) ?? phones[0]
    return primary?.phone
  }, [selectedAppt?.customer?.phones, selectedCustomer])

  const selectedStaffMember = useMemo(() => {
    const ref = appointmentStaff(selectedAppt)
    const refId = ref?.id ?? ref?.staffId
    if (!refId) return null
    return staffList.find(s => s.id === refId) ?? null
  }, [staffList, selectedAppt])

  const selectedStaffName = useMemo(() => {
    if (selectedStaffMember) {
      return `${selectedStaffMember.firstName} ${selectedStaffMember.lastName}`.trim()
    }
    // Fall back to the name on the payload, if it carries one.
    const ref = appointmentStaff(selectedAppt)
    if (ref) {
      const name = `${ref.firstName ?? ""} ${ref.lastName ?? ""}`.trim()
      if (name) return name
    }
    return undefined
  }, [selectedStaffMember, selectedAppt])

  /* ── Helpers ─────────────────────────────────────────────────────── */
  function updateAppointment(id: string, changes: Partial<Appointment>) {
    setAppointments(list =>
      list.map(a => (a.id === id ? { ...a, ...changes } : a)),
    )
    setSelectedAppt(cur => (cur?.id === id ? { ...cur, ...changes } : cur))
  }

  function addAppointment(appt: Appointment) {
    setAppointments(list => [...list, appt])
  }

  function navigateTo(section: string) {
    setNavSection(section as NavSection)
  }

  const [pendingFinanceAction, setPendingFinanceAction] = useState(false)
  void pendingFinanceAction

  function handleAddExpense() {
    setNavSection("finance")
    setPendingFinanceAction(true)
  }

  /* ── Auth flow handlers ──────────────────────────────────────────── */
  function handleLogin() { setAuthScreen("login") }
  function handleSignup(phone?: string) {
    if (phone) setPendingPhone(phone)
    setAuthScreen("verify")
  }
  function handleVerified() { setAuthScreen("login") }
  function handleEditPhone() { setAuthScreen("signup") }

  function handleOnboardingComplete() {
    if (user) localStorage.setItem(onboardingKey(user.id), "1")
    setOnboarded(true)
  }

  /* ── Guards ──────────────────────────────────────────────────────── */
  if (status === "booting") return <BootScreen />

  if (status === "anonymous") {
    return (
      <AuthScreen
        screen={authScreen}
        phone={pendingPhone}
        onNavigate={setAuthScreen}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onVerified={handleVerified}
        onEditPhone={handleEditPhone}
      />
    )
  }

  if (!setupResolved) return <BootScreen />
  if (!onboarded) return <OnboardingWizard onComplete={handleOnboardingComplete} />

  /* ── Section router ──────────────────────────────────────────────── */
  function renderSection() {
    switch (navSection) {
      case "dashboard":
        return (
          <DashboardPage
            // Adapter — legacy DashboardPage still consumes the mock
            // Appointment shape. Delete once migrated.
            appointments={appointments.map(toMockAppt)}
            customers={customers as any}
            feedback={feedback}
            transactions={transactions}
            branches={branches as any}
            onNavigate={navigateTo}
            onNewBooking={() => setShowNewBooking(true)}
            onWalkIn={() => setShowWalkIn(true)}
            onAddExpense={handleAddExpense}
          />
        )

      case "bookings":
  return (
    <div className="relative h-full overflow-hidden">
      <div className="h-full overflow-hidden">
        <BookingDashboard
          appointments={appointments}
          customers={customers}
          branches={branches}
          staff={staffList}
          timezone={branches[0]?.timezone}
          activeBranchId={activeBranchFilter ?? null}
          onSelectAppointment={appt =>
            setSelectedAppt(prev => (prev?.id === appt.id ? null : appt))
          }
          onNewBooking={() => setShowNewBooking(true)}
          onWalkIn={() => setShowWalkIn(true)}
          onUpdateAppointment={updateAppointment}
        />
      </div>

      {/* ── Mobile backdrop (below lg) ──────────────────────────── */}
      {selectedAppt && (
        <div
          className="
            fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px]
            transition-opacity duration-200 ease-out
            opacity-100
            lg:hidden
          "
          onClick={() => setSelectedAppt(null)}
          aria-hidden="true"
        />
      )}

      {/* ── Desktop right panel (lg+) ───────────────────────────── */}
      <div
        className="
          hidden lg:block
          absolute inset-y-0 right-0 z-30
          overflow-hidden
          transition-[width] duration-200 ease-out
        "
        style={{ width: selectedAppt ? 320 : 0 }}
      >
        {selectedAppt && (
          <AppointmentPanel
            appointment={selectedAppt}
            businessId={activeBusinessId!}
            timezone={selectedBranch?.timezone}
            branchName={selectedBranch?.name}
            customerName={selectedCustomerName}
            customerPhone={selectedCustomerPhone}
            staffName={selectedStaffName}
            onClose={() => setSelectedAppt(null)}
            onChanged={updated => {
              setAppointments(prev =>
                prev.map(a => (a.id === updated.id ? updated : a)),
              )
              setSelectedAppt(updated)
            }}
          />
        )}
      </div>

      {/* ── Mobile bottom sheet (below lg) ──────────────────────── */}
      {selectedAppt && (
        <div
          className="
            lg:hidden
            fixed inset-x-0 bottom-0 z-50
            max-h-[85vh] rounded-t-2xl overflow-hidden
            bg-surface border-t border-line shadow-2xl
            animate-sheet-in
          "
        >
          <AppointmentPanel
            appointment={selectedAppt}
            businessId={activeBusinessId!}
            timezone={selectedBranch?.timezone}
            branchName={selectedBranch?.name}
            customerName={selectedCustomerName}
            customerPhone={selectedCustomerPhone}
            staffName={selectedStaffName}
            onClose={() => setSelectedAppt(null)}
            onChanged={updated => {
              setAppointments(prev =>
                prev.map(a => (a.id === updated.id ? updated : a)),
              )
              setSelectedAppt(updated)
            }}
          />
        </div>
      )}
    </div>
  )

      case "services":
        return <ServicesPage />

      case "staff":
        return <StaffPage />

      case "branches":
        return <BranchesPage />

      case "customers":
        return (
          <CustomersPage
            appointments={appointments.map(toMockAppt)}
            feedback={feedback}
          />
        )

      case "feedback":
        return (
          <FeedbackPage
            feedback={feedback}
            staff={staffList as any}
            branches={branches as any}
            onUpdate={setFeedback}
          />
        )

      case "finance":
        return (
          <FinancePage
            transactions={transactions}
            expenseCategories={expCats}
            paymentMethods={payMethods}
            customers={customers as any}
            onUpdateTransactions={setTransactions}
            onUpdateCategories={setExpCats}
            onUpdatePaymentMethods={setPayMethods}
            onUpdateCustomers={setCustomers as any}
            onNavigateToCustomer={() => setNavSection("customers")}
          />
        )

      case "settings":
        return (
          <SettingsPage
            settings={appSettings}
            expenseCategories={expCats}
            paymentMethods={payMethods}
            onUpdateSettings={setAppSettings}
            onUpdateCategories={setExpCats}
            onUpdatePaymentMethods={setPayMethods}
            onLogout={() => void logout()}
          />
        )

      default:
        return null
    }
  }

  // Locked branch for the New Booking modal when the app-level filter is on.
  const lockedBranchId = activeBranchFilter ?? undefined

  return (
    <AppShell activeSection={navSection} onNavigate={setNavSection}>
      {renderSection()}

      <NewBookingModal
        open={showNewBooking}
        businessId={activeBusinessId!}
        lockedBranchId={lockedBranchId}
        customers={customers}
        services={services}
        categories={categories}
        staff={staffList}
        staffDetails={staffDetails}
        branches={branches}
        onClose={() => setShowNewBooking(false)}
        onCreated={appt => {
          setAppointments(prev => [...prev, appt])
          setSelectedAppt(appt)
        }}
        onOpenBranches={() => {
          setShowNewBooking(false)
          setNavSection("branches")
        }}
      />

      <WalkInModal
        open={showWalkIn}
        businessId={activeBusinessId!}
        lockedBranchId={activeBranchFilter ?? undefined}
        branches={branches}
        customers={customers}
        services={services}
        categories={categories}
        staff={staffList}
        staffDetails={staffDetails}
        onClose={() => setShowWalkIn(false)}
        onCreated={appt => {
          setAppointments(prev => [...prev, appt])
          setSelectedAppt(appt)
        }}
      />
    </AppShell>
  )
}

/* ------------------------------------------------------------------ */
/*  Adapters (delete when the consumers below are migrated)            */
/* ------------------------------------------------------------------ */

function toMockAppt(a: Appointment): any {
  const ref = appointmentStaff(a)
  const refId = ref?.id ?? ref?.staffId ?? ""
  const refName = ref
    ? `${ref.firstName ?? ""} ${ref.lastName ?? ""}`.trim()
    : ""

  // Prefer the joined customer for the name/phone. Fall back to
  // placeholder strings only when nothing is available.
  const joinedName = a.customer
    ? `${a.customer.firstName ?? ""} ${a.customer.lastName ?? ""}`.trim()
    : ""
  const joinedPrimary =
    a.customer?.phones?.find(p => p.isPrimary) ?? a.customer?.phones?.[0]

  return {
    id: a.id,
    customerId: a.customerId,
    customerName: joinedName || "Customer",
    customerPhone: joinedPrimary?.phone ?? "",
    serviceId: a.service.id,
    serviceName: a.service.name,
    staffId: refId,
    staffName: refName || "—",
    branchId: a.branchId,
    branchName: a.branchId,
    date: a.scheduledStart.slice(0, 10),
    startTime: new Date(a.scheduledStart).toISOString().slice(11, 16),
    duration: a.service.durationMinutes,
    price: Number(a.totalAmount || 0),
    deposit: a.depositAmount ? Number(a.depositAmount) : undefined,
    paymentStatus: "unpaid",
    status: mockStatusFromApi(a.status),
    notes: a.notes ?? undefined,
    isWalkIn: a.bookingSource === "WALK_IN",
  }
}

function mockStatusFromApi(s: Appointment["status"]): string {
  switch (s) {
    case "PENDING":     return "pending"
    case "CONFIRMED":   return "confirmed"
    case "CHECKED_IN":  return "checked-in"
    case "IN_PROGRESS": return "in-progress"
    case "COMPLETED":   return "completed"
    case "CANCELLED":   return "cancelled"
    case "NO_SHOW":     return "no-show"
    case "EXPIRED":     return "cancelled"
  }
}

/* ------------------------------------------------------------------ */
/*  Response helpers                                                   */
/* ------------------------------------------------------------------ */

function normalizeArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[]
  const anyRes = res as any
  if (Array.isArray(anyRes?.data?.data)) return anyRes.data.data as T[]
  if (Array.isArray(anyRes?.data)) return anyRes.data as T[]
  return []
}

function extractErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (!err) return fallback
  const anyErr = err as any

  if (Array.isArray(anyErr?.fieldErrors) && anyErr.fieldErrors.length > 0) {
    const f = anyErr.fieldErrors[0]
    const prefix = f.field ? `${f.field}: ` : ""
    return `${prefix}${f.message}`
  }

  if (Array.isArray(anyErr?.details) && anyErr.details.length > 0) {
    const d = anyErr.details[0]
    if (typeof d === "string") return d
    if (d && typeof d === "object") {
      const field = d.field ? `${d.field}: ` : ""
      return `${field}${d.message ?? JSON.stringify(d)}`
    }
  }

  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return String(data.errors[0])
  }
  if (Array.isArray(data?.details) && data.details.length > 0) {
    const d = data.details[0]
    if (typeof d === "string") return d
    if (d && typeof d === "object") {
      const field = d.field ? `${d.field}: ` : ""
      return `${field}${d.message ?? JSON.stringify(d)}`
    }
  }

  if (typeof data?.message === "string" && data.message) return data.message
  if (typeof anyErr?.message === "string" && anyErr.message) return anyErr.message
  return fallback
}