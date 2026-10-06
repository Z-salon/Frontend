// ============================================================
// Enums (§1)
// ============================================================

export type OtpPurpose =
  | 'LOGIN'
  | 'REGISTRATION'
  | 'PASSWORD_RESET'
  | 'PHONE_VERIFICATION'
  | 'INVITATION_ACCEPTANCE'
  | 'PHONE_CHANGE';

export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED';

export type MemberStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

export type RoleScopeType = 'BUSINESS' | 'BRANCH';

export type ServiceStatus = 'ACTIVE' | 'INACTIVE';

export type EmployeeAssignmentMode =
  | 'CUSTOMER_CHOOSES'
  | 'SALON_ASSIGNS'
  | 'ANY_AVAILABLE';

export type DepositPolicyType = 'NONE' | 'FIXED' | 'PERCENTAGE' | 'FULL';

export type RefundPolicyType = 'NO_REFUND' | 'FULL_REFUND' | 'PERCENTAGE_REFUND';

export type SystemRoleKey = 'OWNER' | 'ADMIN' | 'BRANCH_MANAGER' | 'RECEPTIONIST';

/** 0 = Sunday … 6 = Saturday (§6.1) */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ============================================================
// §2 Auth
// ============================================================

export interface AuthUser {
  id: string;
  phone: string;
  phoneVerifiedAt: string | null;
  status: UserStatus;
  createdAt: string;
}

export interface SessionInfo {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  /** True only for the session that issued the current access token. */
  currentSession: boolean;
}

export interface RoleSummary {
  id: string;
  name: string;
  systemKey: SystemRoleKey | string;
}

export interface UserRoleAssignment {
  scopeType: RoleScopeType;
  role: RoleSummary;
  /**
   * Populated when `scopeType === 'BRANCH'`. Empty for BUSINESS-scoped roles
   * (§2.14). When any role is BUSINESS-scoped, the user can reach every branch.
   */
  branches: Array<{ id: string; name: string }>;
}

export interface BusinessSummary {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  status: string;
}

export interface Membership {
  id: string;
  businessId: string;
  status: MemberStatus;
  business: BusinessSummary;
  userRoles: UserRoleAssignment[];
}

export interface MeResponse extends AuthUser {
  memberships: Membership[];
}

/** Returned by login, register/verify and login/complete (§2.5, §2.6, §2.7). */
export interface LoginResponse {
  accessToken: string;
  user: Pick<AuthUser, 'id' | 'phone' | 'phoneVerifiedAt'>;
}

// ============================================================
// §3 Business
// ============================================================

export interface BranchPhone {
  id: string;
  /** Exposed as `phone`, not `phoneNumber` (§5.5 note). */
  phone: string;
  label: string | null;
  isPrimary: boolean;
  isActive: boolean;
}

export interface BusinessBranchSummary {
  id: string;
  name: string;
  address: string | null;
  email: string | null;
  timezone: string;
  phones: BranchPhone[];
}

export interface BusinessConfig {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  status: string;
  /** First active branch (oldest by createdAt), or a placeholder (§3.1). */
  branch: BusinessBranchSummary;
  createdAt: string;
  updatedAt: string;
}

export interface BrandingPayload {
  /**
   * The server returns these as nested `{ url, publicId }` objects
   * (§3.3). Null when the business hasn't uploaded one.
   */
  id: string
  name: string
  slug: string
  currency: string
  timezone: string

  logo: { url: string; publicId: string } | null
  cover: { url: string; publicId: string } | null

  /**
   * @deprecated — the flat shape was an artifact of an older Swagger
   * spec. Prefer `logo?.url` / `cover?.url`. Kept optional so
   * mid-migration code still type-checks.
   */
  logoUrl?: string | null
  /** @deprecated — use `cover?.url` */
  coverImageUrl?: string | null

  primaryColor: string | null
  secondaryColor: string | null
  description: string | null
  aboutUs: string | null
  website: string | null
  facebookUrl: string | null
  instagramUrl: string | null
  telegramUrl: string | null
  tiktokUrl: string | null

  branches: Array<{
    id: string
    name: string
    address: string | null
    email: string | null
    timezone: string
    phones: BranchPhone[]
  }>

  serviceCategories: Array<{
    id: string
    name: string
    description: string | null
    sampleWorks: Array<{
      id: string
      url: string
      /** §8.6 — always returned by the server. */
      publicId: string
      name: string
      description: string | null
      serviceCategoryId: string
    }>
  }>
}

/**
 * Fields accepted by PATCH /businesses/{id}/branding (§3.4).
 *
 * The body is `.strict()`: sending unknown fields (e.g. `address`,
 * `phone`, `email`) returns 400. `logo` and `cover` are nested
 * `{ url, publicId }` objects — the same shape the server returns
 * from the GET. Pass `null` to clear an image; the backend deletes
 * the old Cloudinary asset.
 */
export type BrandingUpdateInput = Partial<{
  logo: { url: string; publicId: string } | null
  cover: { url: string; publicId: string } | null
  primaryColor: string | null
  secondaryColor: string | null
  description: string | null
  aboutUs: string | null
  website: string | null
  facebookUrl: string | null
  instagramUrl: string | null
  telegramUrl: string | null
  tiktokUrl: string | null
}>

// ============================================================
// §4 Payment Methods
// ============================================================

export interface PaymentMethod {
  id: string;
  businessId: string;
  name: string;
  /**
   * Free-form string in the DB (§11.3). Conventionally
   * CASH | BANK_TRANSFER | MOBILE_MONEY | CARD | OTHER.
   */
  type: string;
  accountName: string | null;
  accountNumber: string | null;
  instructions: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Customer-facing projection (§4.1) — omits isActive, displayOrder, timestamps. */
export interface PublicPaymentMethod {
  id: string;
  name: string;
  type: string;
  accountName: string | null;
  accountNumber: string | null;
  instructions: string | null;
}

export interface PaymentMethodInput {
  name: string;
  type: string;
  accountName?: string;
  accountNumber?: string;
  instructions?: string;
  isActive?: boolean;
  displayOrder?: number;
}

// ============================================================
// §5 Branches
// ============================================================

export interface Branch {
  id: string;
  businessId: string;
  name: string;
  address: string | null;
  /** Never settable via API (§11.6) — read-only. */
  email: string | null;
  timezone: string;
  isActive: boolean;
  phones: BranchPhone[];
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyInterval {
  id?: string;
  /** HH:mm 24-hour (§6.1) */
  startTime: string;
  /** HH:mm 24-hour */
  endTime: string;
}

export interface WeeklySchedule {
  id: string;
  dayOfWeek: DayOfWeek;
  isClosed: boolean;
  intervals: WeeklyInterval[];
}

export interface DateOverride {
  id: string;
  /** Full ISO timestamp in responses, even though requests send YYYY-MM-DD (§6.3). */
  date: string;
  isClosed: boolean;
  intervals: WeeklyInterval[];
}

/**
 * GET /{businessId}/branches/{branchId} (§5.3).
 * `bookingConfig` here is a flat subset — use §7 for the canonical shape.
 */
export interface BranchDetail extends Branch {
  weeklySchedules: WeeklySchedule[];
  dateOverrides: DateOverride[];
  bookingConfig: Record<string, unknown>;
}

/** Request shape for PUT .../weekly-hours (§6.2) — full replace, 7 days. */
export interface WeeklyHoursInput {
  days: Array<{
    dayOfWeek: DayOfWeek;
    isClosed?: boolean;
    intervals?: Array<{ start: string; end: string }>;
  }>;
}

/** Request shape for date override create/update (§6.3). */
export interface DateOverrideInput {
  date: string;
  isClosed: boolean;
  intervals?: Array<{ start: string; end: string }>;
}

// ============================================================
// §7 Booking Config (canonical grouped shape)
// ============================================================

export interface BookingConfig {
  booking: {
    onlineBookingEnabled: boolean;
    walkInEnabled: boolean;
    bookingApprovalRequired: boolean;
    minimumAdvanceBookingMinutes: number;
    maximumAdvanceBookingDays: number;
    bookingBufferMinutes: number;
    waitlistEnabled: boolean;
  };
  cancellation: {
    cancellationWindowMinutes: number;
    reschedulingEnabled: boolean;
    customerCancellationEnabled: boolean;
    customerCancellationPolicy: string;
    refundPolicyType: RefundPolicyType;
    refundPercentage: number | null;
    refundDeadlineHours: number;
  };
  confirmation: {
    customerConfirmationEnabled: boolean;
    confirmationReminderHours: number;
    confirmationDeadlineHours: number;
    sameDayConfirmationReminderHours: number;
    pendingAppointmentExpirationMinutes: number;
  };
}

/**
 * PATCH body for §7.2. MUST use nested groups — a flat body is rejected
 * by the strict schema (§7.2, §11.2).
 */
export type BookingConfigPatch = Partial<{
  booking: Partial<BookingConfig['booking']>;
  cancellation: Partial<BookingConfig['cancellation']>;
  confirmation: Partial<BookingConfig['confirmation']>;
}>;

// ============================================================
// §8 Service Categories
// ============================================================

export interface CategoryBranchAssignment {
  id: string;
  categoryId: string;
  branchId: string;
  isActive: boolean;
  branch: { id: string; name: string; isActive: boolean };
}

export interface ServiceCategory {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  status: ServiceStatus;
  branchAssignments: CategoryBranchAssignment[];
  /** Present on list responses (§8.2) — a lightweight summary. */
  services?: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    price: string;
    status: ServiceStatus;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceCategoryInput {
  name: string;
  description?: string;
  branchIds: string[];
}

export interface UpdateServiceCategoryInput {
  name?: string;
  description?: string | null;
  status?: ServiceStatus;
}

// ============================================================
// §9 Services
// ============================================================

export interface ServiceBranchAssignment {
  id: string;
  serviceId: string;
  branchId: string;
  isActive: boolean;
  /** null = inherit the service value (§9.5) */
  durationMinutes: number | null;
  /** null = inherit; serialized as string (Decimal, §11.11) */
  price: string | null;
  bufferMinutes: number;
  branch: { id: string; name: string; isActive: boolean };
}

export interface Service {
  id: string;
  businessId: string;
  categoryId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  /** Decimal → JSON string (§11.11). Parse before arithmetic. */
  price: string;
  employeeAssignmentMode: EmployeeAssignmentMode;
  showPriceToCustomer: boolean;
  depositPolicyType: DepositPolicyType;
  /** Decimal → JSON string, or null. */
  depositAmount: string | null;
  status: ServiceStatus;
  category: {
    id: string;
    name: string;
    status: ServiceStatus;
    businessId?: string;
  };
  branchAssignments: ServiceBranchAssignment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceInput {
  categoryId: string;
  name: string;
  description?: string;
  /** Must be > 0. */
  durationMinutes: number;
  /** ≥ 0. Number or numeric string — server stores Decimal(12,2). */
  price: number | string;
  employeeAssignmentMode: EmployeeAssignmentMode;
  showPriceToCustomer?: boolean;
  depositPolicyType?: DepositPolicyType;
  /** Constraints depend on depositPolicyType (§9.1 deposit rules). */
  depositAmount?: number | string | null;
  branchIds: string[];
}

export interface UpdateServiceInput {
  categoryId?: string;
  name?: string;
  description?: string | null;
  durationMinutes?: number;
  price?: number | string;
  employeeAssignmentMode?: EmployeeAssignmentMode;
  showPriceToCustomer?: boolean;
  depositPolicyType?: DepositPolicyType;
  depositAmount?: number | string | null;
  status?: ServiceStatus;
}

/** PATCH .../branches/{branchId}/config body (§9.5). `isActive` is REQUIRED. */
export interface ServiceBranchConfigInput {
  isActive: boolean;
  durationMinutes?: number | null;
  price?: number | string | null;
  bufferMinutes?: number;
}

/** GET .../branches/{branchId}/effective-config response (§9.5). */
export interface EffectiveServiceConfig {
  serviceId: string;
  branchId: string;
  name: string;
  durationMinutes: number;
  /** Decimal → string. */
  price: string;
  bufferMinutes: number;
  employeeAssignmentMode: EmployeeAssignmentMode;
  showPriceToCustomer: boolean;
  depositPolicyType: DepositPolicyType;
  /** Decimal → string, or null. */
  depositAmount: string | null;
  isActive: boolean;
}

// ============================================================
// §12 Staff
// ============================================================

export type StaffStatus = 'ACTIVE' | 'INACTIVE';

export interface Staff {
  id: string;
  businessId: string;
  /** Home branch. */
  branchId: string;
  /** Link to a login user, if any. Never settable through this API (§12.2). */
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  bio: string | null;
  status: StaffStatus;
  createdAt: string;
  updatedAt: string;
  /** Present on list responses (§12.4). */
  branch?: { id: string; name: string; isActive: boolean };
}

// ============================================================
// §13 Staff Qualifications
// ============================================================

export type ProficiencyLevel = 'TRAINEE' | 'JUNIOR' | 'SENIOR' | 'EXPERT';

export interface StaffCategoryQualification {
  id: string;
  staffId: string;
  categoryId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Present on detail responses (§12.5). */
  category?: { id: string; name: string; status: ServiceStatus };
}

export interface StaffServiceQualification {
  id: string;
  staffId: string;
  serviceId: string;
  proficiencyLevel: ProficiencyLevel;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Present on detail responses (§12.5). */
  service?: { id: string; name: string; status: ServiceStatus };
}

/** GET /staff/{staffId} (§12.5) — full detail with active qualifications. */
export interface StaffDetail extends Staff {
  branch: { id: string; name: string; isActive: boolean };
  categoryQualifications: StaffCategoryQualification[];
  serviceQualifications: StaffServiceQualification[];
}

// ============================================================
// §14 Staff Time Off
// ============================================================

export interface StaffTimeOff {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  allDay: boolean;
  /** HH:mm | null */
  start: string | null;
  /** HH:mm | null */
  end: string | null;
  reason: string | null;
}

/**
 * Create input — discriminated union so the compiler enforces the
 * allDay rules from §14.3:
 *
 *   { date, allDay: true,  reason? }
 *   { date, allDay: false, start, end, reason? }
 */
export type StaffTimeOffInput =
  | { date: string; allDay: true;  reason?: string; start?: never; end?: never }
  | { date: string; allDay: false; start: string; end: string; reason?: string };

export interface StaffTimeOffUpdateInput {
  allDay?: boolean;
  start?: string | null;
  end?: string | null;
  reason?: string | null;
}

// ============================================================
// §3 Customers
// ============================================================

export type CustomerStatus = 'ACTIVE' | 'ARCHIVED';

export interface CustomerPhone {
  id: string;
  phone: string;
  isPrimary: boolean;
  /** Per §3.4 responses; may not be present on the create response. */
  label?: string | null;
  isActive?: boolean;
}

export interface Customer {
  id: string;
  businessId: string;
  firstName: string;
  lastName: string;
  status: CustomerStatus;
  phones: CustomerPhone[];
  createdAt: string;
  updatedAt?: string;
}

// ============================================================
// Enum reference (§12)
// ============================================================

export type RefundRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED';
export type PaymentStatus = 'PAID' | 'VOIDED';
export type ReceiptStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type CustomerConfirmationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'DECLINED'
  | 'EXPIRED';
export type ActorType = 'USER' | 'SYSTEM';

/** §7.2 — tighten if the server enumerates */
export type CustomerCancellationPolicy = 'ALWAYS' | 'BEFORE_DEADLINE' | 'NEVER';

// ============================================================
// §8.6 Sample works
// ============================================================

/** §8.6 — `publicId` is required by the create schema. */
export interface SampleWorkInput {
  name: string;
  url: string;
  publicId: string;
  description?: string;
}

/** §8.6 — the row shape returned by every sample-work endpoint. */
export interface SampleWork {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  url: string;
  publicId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * §8.6 — every field optional. `description: null` clears it, which is
 * different from omitting the key (leaves it untouched).
 */
export interface UpdateSampleWorkInput {
  name?: string;
  url?: string;
  publicId?: string;
  description?: string | null;
}

// ============================================================
// §5 / §9 Appointments
// ============================================================

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'EXPIRED';

export type BookingSource = 'ONLINE' | 'STAFF' | 'PHONE' | 'WALK_IN';

/**
 * The staff reference embedded in an appointment payload (§5.1 / §5.3
 * list responses).
 *
 * NOTE: the server returns a **single object** (not an array), keyed by
 * `id` — not `staffId`. `staffId` is retained as an optional alias so
 * code mid-migration still type-checks; remove it once all call sites
 * use `id`.
 */
export interface AppointmentStaffRef {
  id: string;
  firstName: string;
  lastName: string;
  /** @deprecated — use `id`. Kept for transitional compatibility. */
  staffId?: string;
}

export interface AppointmentCustomerSummary {
  id: string;
  firstName: string;
  lastName: string;
  phones: Array<{ id: string; phone: string; isPrimary: boolean }>;
}

export interface Appointment {
  id: string;
  businessId: string;
  branchId: string;
  customerId: string;
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    price: string;
  };
  /**
   * The staff member assigned to this appointment. Single object, not
   * an array. `null` if unassigned.
   */
  staff: AppointmentStaffRef | null;
  scheduledStart: string; // ISO UTC
  scheduledEnd: string;   // ISO UTC
  status: AppointmentStatus;
  bookingSource: BookingSource;
  totalAmount: string;    // Decimal → string
  depositAmount: string | null;
  notes: string | null;
  internalNotes: string | null;

  /**
   * Joined customer summary. Present on list responses (§5.3); may be
   * absent on single-get responses in some serializer configurations.
   */
  customer?: AppointmentCustomerSummary;

  // Optional operational timestamps
  checkedInAt?: string | null;
  confirmedAt?: string | null;
  inProgressAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  noShowAt?: string | null;
}

// ============================================================
// §5.11 Status history
// ============================================================

export interface AppointmentStatusHistoryEntry {
  id: string;
  appointmentId: string;
  statusFrom: AppointmentStatus | null;
  statusTo: AppointmentStatus;
  actorId: string | null;
  actorType: ActorType;
  reason: string | null;
  transitionTimestamp: string;
  actor?: { id: string; phone: string } | null;
}

// ============================================================
// §6 Service usage
// ============================================================

export interface ServiceUsageProduct {
  name: string
  quantity: number
  unit: string
}

export interface ServiceUsage {
  id: string;
  appointmentId: string;
  businessId: string;
  branchId: string;
  serviceId: string | null;
  serviceName: string;
  serviceDetails: string | null;
  productsUsed: ServiceUsageProduct[] | null;
  notes: string | null;
  recordedById: string;
  recordedAt: string;
  updatedAt?: string | null;
  /** Only on the list endpoint (§6.2) — identifies who logged the entry. */
  recordedBy?: { id: string; phone?: string | null } | null;
}

/**
 * `POST /businesses/:businessId/appointments/:id/service-usages`
 *
 * Only accepted while the appointment is CHECKED_IN, IN_PROGRESS, or
 * COMPLETED. `branchId` and `recordedById` are derived server-side, so
 * they are never sent. `serviceName` is the only required field.
 */
export interface ServiceUsageInput {
  serviceName: string
  serviceId?: string | null
  serviceDetails?: string | null
  productsUsed?: ServiceUsageProduct[] | null
  notes?: string | null
}

/** `PATCH /businesses/:businessId/service-usages/:usageId` — any subset. */
export interface ServiceUsageUpdateInput {
  serviceName?: string
  serviceDetails?: string | null
  productsUsed?: ServiceUsageProduct[] | null
  notes?: string | null
}

// ============================================================
// §7 Appointment payments
// ============================================================

export interface AppointmentPayment {
  id: string;
  appointmentId: string;
  businessId: string;
  branchId: string;
  paymentMethodId: string;
  paymentMethod?: { name: string; type: string } | null;
  amount: string;
  status: PaymentStatus;
  reference: string | null;
  notes: string | null;
  recordedById: string;
  paidAt: string;
  /** Only on the list endpoint (§7.2). */
  recordedBy?: { id: string; phone?: string | null } | null;
}

/** One row of the split-tender array sent to §7.1. */
export interface AppointmentPaymentLine {
  paymentMethodId: string
  /** > 0 — the API rejects anything else with 400. Decimal-safe number. */
  amount: number
}

/**
 * `POST /businesses/:businessId/appointments/:id/payments`
 *
 * Accepts either the single-method shape or a `payments` array. Each entry
 * becomes its own `AppointmentPayment` row in one transaction, so a split
 * tender (1000 cash + 1500 card) either fully lands or not at all.
 * Response `data` is an array with one payment per method.
 */
export interface AppointmentPaymentsInput {
  payments: AppointmentPaymentLine[]
  reference?: string | null
  notes?: string | null
}

// ------------------------------------------------------------------
//  §12 Feedback
// ------------------------------------------------------------------

export type FeedbackCategoryType = 'RATING' | 'TEXT' | 'BOOLEAN'

export type FeedbackRequestStatus = 'PENDING' | 'SUBMITTED' | 'EXPIRED'

/**
 * A feedback category as exposed on the customer-facing form
 * (`GET /feedback/{token}`).
 *
 * Snake-case field names here are intentional — the server returns
 * the form payload with snake_case keys (§12.2 example).
 */
export interface FeedbackFormCategory {
  id: string
  name: string
  description: string | null
  type: FeedbackCategoryType
  rating_scale_min: number | null
  rating_scale_max: number | null
  sort_order: number
}

export interface FeedbackFormBusiness {
  id: string
  name: string
}

/**
 * `GET /feedback/{token}` — the public feedback form. Only enabled
 * categories are returned. No customer identity is exposed.
 */
export interface FeedbackFormResponse {
  request_id: string
  /** ISO 8601. The request expires 7 days after creation. */
  expires_at: string
  business: FeedbackFormBusiness
  categories: FeedbackFormCategory[]
}

/**
 * `POST /feedback/submit` input.
 *
 * Each response targets a single category. The `category_id` must
 * belong to the business and be enabled; the value field must match
 * the category `type`:
 *   RATING  → rating_value   (within [rating_scale_min, rating_scale_max])
 *   TEXT    → text_response
 *   BOOLEAN → boolean_response
 */
export type FeedbackResponseInput =
  | { category_id: string; rating_value: number }
  | { category_id: string; text_response: string }
  | { category_id: string; boolean_response: boolean }

export interface FeedbackSubmitInput {
  token: string
  is_anonymous: boolean
  responses: FeedbackResponseInput[]
}

/** `POST /feedback/submit` response (201). */
export interface FeedbackSubmitResponse {
  submission_id: string
  is_anonymous: boolean
  submitted_at: string
}

/* ------------------------------------------------------------------ */
/*  Admin-side shapes                                                  */
/* ------------------------------------------------------------------ */

/**
 * A feedback category as returned by the admin list endpoint
 * (`GET /businesses/{id}/feedback-categories`).
 *
 * NOTE: unlike the form payload, admin endpoints return camelCase
 * field names (matching the rest of the admin API).
 */
export interface FeedbackCategory {
  id: string
  businessId: string
  name: string
  description: string | null
  type: FeedbackCategoryType
  ratingScaleMin: number | null
  ratingScaleMax: number | null
  sortOrder: number
  isEnabled: boolean
  /** Number of responses received for this category. */
  responseCount: number
  createdAt: string
  updatedAt: string
}

export interface FeedbackCategoryInput {
  name: string
  type: FeedbackCategoryType
  description?: string
  ratingScaleMin?: number | null
  ratingScaleMax?: number | null
  sortOrder?: number
}

export interface FeedbackCategoryUpdateInput {
  name?: string
  description?: string | null
  ratingScaleMin?: number | null
  ratingScaleMax?: number | null
  sortOrder?: number
  isEnabled?: boolean
}

/**
 * A single admin-side feedback submission.
 *
 * Privacy contract (§12.4): when `isAnonymous` is `true`, both
 * `customer` and `appointment` are `null` server-side — no
 * identifying context leaks.
 */
export interface FeedbackSubmission {
  id: string
  isAnonymous: boolean
  submittedAt: string
  customer: FeedbackSubmissionCustomer | null
  appointment: FeedbackSubmissionAppointment | null
  responses: FeedbackSubmissionResponse[]
}

export interface FeedbackSubmissionCustomer {
  id: string
  firstName: string
  lastName: string
  phone: string | null
}

export interface FeedbackSubmissionAppointment {
  id: string
  scheduledStart: string
  scheduledEnd: string
  status: AppointmentStatus
  branch: { id: string; name: string } | null
  service: { id: string; name: string } | null
  staff: Array<{ id: string; firstName: string; lastName: string }>
}

export interface FeedbackSubmissionResponse {
  id: string
  categoryId: string
  category: { id: string; name: string; type: FeedbackCategoryType }
  ratingValue: number | null
  textResponse: string | null
  booleanResponse: boolean | null
}

/* ------------------------------------------------------------------ */
/*  Admin — resend feedback request (proposed)                         */
/* ------------------------------------------------------------------ */

/**
 * `POST /businesses/{businessId}/appointments/{appointmentId}/feedback-request/resend`
 *
 * Re-mints the token and re-delivers the link. See
 * `docs/FEEDBACK-RESEND-PROPOSAL.md` — this endpoint is not implemented yet,
 * so the admin button surfaces the error until it ships.
 *
 * Only the raw token ever exists in this response; the server keeps just its
 * SHA-256 hash.
 */
export interface FeedbackResendResult {
  request_id: string
  appointment_id: string
  /** Absolute link including the raw token. */
  feedback_url?: string | null
  /** Whether the SMS gateway accepted the message. */
  delivered?: boolean | null
  expires_at?: string | null
  resend_count?: number | null
}

/* ------------------------------------------------------------------ */
/*  Admin list query                                                   */
/* ------------------------------------------------------------------ */

export interface FeedbackListQuery {
  page?: number
  /** ≤ 100. */
  limit?: number
  /** ISO datetime — filtered on `submitted_at`. */
  from_date?: string
  /** ISO datetime — filtered on `submitted_at`. */
  to_date?: string
  branch_id?: string
  category_id?: string
  is_anonymous?: boolean
}

// ============================================================
// §7.3 Appointment receipts
// ============================================================

/**
 * Customer-submitted proof of a bank/mobile transfer. Admin reviews it
 * via PATCH …/receipt/verify and, on approval, a PAID AppointmentPayment
 * is created and the appointment is atomically confirmed.
 *
 * Field names are camelCase (matches the admin/customer API surface,
 * unlike the feedback *form* which is snake_case).
 */
export interface AppointmentReceipt {
  id: string
  appointmentId: string
  businessId: string
  paymentMethodId: string
  /** Decimal → string. */
  submittedAmount: string
  receiptImageUrl: string
  receiptImagePublicId: string
  customerNote: string | null
  status: ReceiptStatus
  rejectionReason: string | null
  submittedAt: string
  reviewedAt: string | null
  reviewedById: string | null
}

/** `POST /customer/appointments/:id/receipt` and the public variant. */
export interface SubmitReceiptInput {
  paymentMethodId: string
  submittedAmount: number
  receiptImageUrl: string
  receiptImagePublicId: string
  customerNote?: string
}

// ============================================================
// Expense categories
// ============================================================

/**
 * `GET /businesses/{businessId}/expense-categories`
 *
 * Names are unique per business, so a duplicate POST/PATCH comes back as a
 * 4xx — the server stays the authority on uniqueness. There is no DELETE:
 * a category is retired by flipping `isActive` through PATCH, which keeps
 * historical expenses pointing at a real row.
 */
export interface ExpenseCategory {
  id: string
  businessId: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
}

/** `POST /businesses/{businessId}/expense-categories` */
export interface CreateExpenseCategoryRequest {
  name: string
  description?: string
}

/**
 * `PATCH /businesses/{businessId}/expense-categories/{categoryId}`
 *
 * Also how activation works: `{ isActive: true }` / `{ isActive: false }`.
 */
export interface UpdateExpenseCategoryRequest {
  name?: string
  description?: string
  isActive?: boolean
}

// ============================================================
// Expense ledger
// ============================================================

/**
 * `GET /businesses/{businessId}/expenses?status=…`
 * The only values the endpoint documents (OpenAPI enum).
 */
export type ExpenseStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'VOIDED'

/** Compact embedded reference returned on the expense. */
export interface ExpenseRef {
  id: string
  name: string
}

export interface ExpensePaymentMethodRef {
  id: string
  name: string
  type: string
}

export interface ExpenseCreatedByRef {
  id: string
  phone: string
}

/**
 * `GET /businesses/{businessId}/expenses/:expenseId`
 *
 * Monetary values come back as decimal strings ("500.00") and the server is
 * the authority on `status` / `amountPaid` — never derive them on the client.
 */
export interface Expense {
  id: string
  businessId: string
  branchId: string
  categoryId: string
  /** Decimal → string. */
  amount: string
  /** Decimal → string. */
  amountPaid: string
  status: ExpenseStatus
  description: string | null
  vendor: string | null
  receiptNumber: string | null
  notes: string | null
  expenseDate: string
  dueDate: string | null
  paidAt: string | null
  voidedAt: string | null
  voidReason: string | null
  createdById: string
  category?: ExpenseRef
  branch?: ExpenseRef
  paymentMethod?: ExpensePaymentMethodRef
  createdBy?: ExpenseCreatedByRef
  createdAt: string
  updatedAt: string
}

/** `meta` from the standard list envelope. */
export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * `GET /businesses/{businessId}/appointments`
 *
 * The list envelope nests the collection: the raw body is
 * `{ success, message, data: { data: Appointment[], meta } }`.
 * `http` unwraps the outer `data`, so callers receive `{ data, meta }`.
 */
export interface AppointmentListResult {
  data: Appointment[]
  meta: PaginationMeta | null
}

/** `GET /businesses/{businessId}/expenses` query — `page`/`limit` match §5.3. */
export type ExpenseListQuery = {
  /** ISO date or datetime; date-only spans whole days (business timezone). */
  from?: string
  to?: string
  branchId?: string
  categoryId?: string
  status?: ExpenseStatus
  page?: number
  limit?: number
}

/**
 * `POST /businesses/{businessId}/expenses`
 *
 * The request-body contract is not documented in the repo or OpenAPI spec, so
 * the shape is inferred from the response model and the UI fields. Amounts are
 * sent as numbers, matching the appointment-payment convention already in use.
 */
export interface CreateExpenseRequest {
  branchId: string
  categoryId: string
  amount: number
  expenseDate: string
  description?: string
  vendor?: string
  receiptNumber?: string
  notes?: string
  dueDate?: string
  paymentMethodId?: string
}

/** `PATCH /businesses/{businessId}/expenses/:expenseId` */
export type UpdateExpenseRequest = Partial<CreateExpenseRequest>

/**
 * `POST /businesses/{businessId}/expenses/:expenseId/payments`
 *
 * Records cash against the expense; the server recomputes `amountPaid` and
 * `status`. `amountPaid` is NOT a client field.
 */
export interface RecordExpensePaymentRequest {
  amount: number
  paymentMethodId?: string
  reference?: string
  notes?: string
}

/** `POST /businesses/{businessId}/expenses/:expenseId/void` */
export interface VoidExpenseRequest {
  reason: string
}

// ============================================================
// Finance reporting (Overview / Reports / Outstanding)
// ============================================================

/**
 * Common Finance Report query.
 *
 * `from`/`to` are ISO date or datetime; a date-only value spans the whole
 * day in the business timezone. Omit `branchId` (undefined) for "all
 * branches" — never send a branch name where a UUID is expected.
 */
export type FinanceReportQuery = {
  from?: string
  to?: string
  branchId?: string
}

/** The authoritative period echoed by every report. */
export interface FinancePeriod {
  from: string | null
  to: string | null
  timezone: string
}

export interface FinanceFilterInfo {
  branchId: string | null
  /** `summary` reports it; other endpoints may omit it. */
  allBranches?: boolean
}

/* ---- Summary -------------------------------------------------------- */

export interface FinanceSummaryTotals {
  totalRevenue: string
  totalPaymentsCollected: string
  totalRefunds: string
  totalOutstanding: string
  totalExpenses: string
  totalExpensesPaid: string
  totalExpensesUnpaid: string
  netOperatingResult: string
  netCashMovement: string
  revenueBasis: string
  transactionCount: number
  appointmentCount: number
  expenseCount: number
}

export interface FinanceBranchSummaryRow {
  branchId: string
  branchName: string
  revenue: string
  collected: string
  refunds: string
  expenses: string
  expensesPaid: string
  netOperatingResult: string
}

export interface FinanceServiceRow {
  serviceId: string
  serviceName: string
  amount: string
  count: number
}

export interface FinancePaymentMethodRow {
  paymentMethodId: string
  paymentMethodName: string
  paymentMethodType: string
  amount: string
  count: number
}

export interface FinanceExpenseCategoryRow {
  categoryId: string
  categoryName: string
  amount: string
  amountPaid: string
  count: number
}

/** One day of a report's `byDate` breakdown. Only the fields the endpoint
 *  actually returns for that report are populated. */
export interface FinanceDateRow {
  date: string
  revenue?: string
  collected?: string
  refunds?: string
  expenses?: string
  expensesPaid?: string
}

export interface FinanceSummaryReport {
  period: FinancePeriod
  filters: FinanceFilterInfo
  summary: FinanceSummaryTotals
  breakdowns: {
    byBranch: FinanceBranchSummaryRow[]
    byService: FinanceServiceRow[]
    byPaymentMethod: FinancePaymentMethodRow[]
    byExpenseCategory: FinanceExpenseCategoryRow[]
    byDate: FinanceDateRow[]
  }
}

/* ---- Revenue -------------------------------------------------------- */

export interface FinanceRevenueReport {
  period: FinancePeriod
  filters: FinanceFilterInfo
  totalRevenue: string
  appointmentCount: number
  breakdowns: {
    byBranch: Array<{
      branchId: string
      branchName: string
      revenue: string
      count: number
    }>
    byService: FinanceServiceRow[]
    byDate: Array<{ date: string; revenue: string }>
  }
}

/* ---- Collections ---------------------------------------------------- */

export interface FinanceCollectionReport {
  period: FinancePeriod
  filters: FinanceFilterInfo
  totalCollected: string
  totalRefunds: string
  netCollected: string
  transactionCount: number
  breakdowns: {
    byPaymentMethod: FinancePaymentMethodRow[]
    byBranch: Array<{
      branchId: string
      branchName: string
      collected: string
      refunds: string
    }>
    byRecordedBy: Array<{
      recordedById: string
      recordedByPhone: string
      amount: string
      count: number
    }>
    byDate: Array<{ date: string; collected: string }>
  }
}

/* ---- Refunds -------------------------------------------------------- */

export interface FinanceRefundStatusRow {
  status: string
  count: number
  amount?: string
  requestedAmount?: string
  approvedAmount?: string
  completedAmount?: string
  rejectedAmount?: string
}

/**
 * `byStatus` is documented/observed in two shapes:
 *   · an array of rows (`[{ status, count, … }]`)
 *   · a keyed object (`{ PENDING: { count, amount }, … }`)
 * The UI normalizes either into `FinanceRefundStatusRow[]` before rendering.
 */
export type FinanceRefundStatusBreakdown =
  | FinanceRefundStatusRow[]
  | Record<string, Partial<FinanceRefundStatusRow>>

export interface FinanceRefundBranchRow {
  branchId: string
  branchName: string
  amount: string
  count: number
}

/**
 * Refund report. The OpenAPI spec does not publish the payload schema, so the
 * optional fields below cover both the flat and `breakdowns`-nested shapes the
 * endpoint may return; the UI reads whichever is present.
 */
export interface FinanceRefundReport {
  period?: FinancePeriod
  filters?: FinanceFilterInfo
  totalRefunds?: string
  refundCount?: number
  completedRefundAmount?: string
  completedRefundCount?: number
  byStatus?: FinanceRefundStatusBreakdown
  byBranch?: FinanceRefundBranchRow[]
  breakdowns?: {
    byStatus?: FinanceRefundStatusBreakdown
    byBranch?: FinanceRefundBranchRow[]
  }
}

/* ---- Expenses report ------------------------------------------------ */

export interface FinanceExpenseReport {
  period: FinancePeriod
  filters: FinanceFilterInfo
  totalExpenses: string
  totalExpensesPaid: string
  totalExpensesUnpaid: string
  expenseCount: number
  breakdowns: {
    byCategory: FinanceExpenseCategoryRow[]
    byBranch: Array<{
      branchId: string
      branchName: string
      amount: string
      amountPaid: string
    }>
    byDate: Array<{ date: string; expenses: string; expensesPaid: string }>
  }
}

/* ---- Outstanding ---------------------------------------------------- */

export interface FinanceOutstandingAppointment {
  appointmentId: string
  branchId?: string | null
  branchName?: string | null
  customerId?: string | null
  customerName?: string | null
  customerPhone?: string | null
  scheduledStart?: string | null
  status?: string | null
  originalAmount?: string
  finalAgreedAmount?: string
  verifiedPaid?: string
  outstanding: string
}

export interface FinanceOutstandingReport {
  asOf?: string
  filters?: FinanceFilterInfo
  totalOutstanding: string
  appointments: FinanceOutstandingAppointment[]
  meta?: PaginationMeta | null
}

/** `GET /businesses/{businessId}/finance/outstanding` query. */
export type FinanceOutstandingQuery = {
  branchId?: string
  page?: number
  limit?: number
}

/* ------------------------------------------------------------------ */
/*  §8 Refund requests (operational queue)                             */
/*                                                                     */
/*  These are the `/refund-requests` workflow endpoints, distinct from */
/*  the read-only `/finance/refunds` reporting endpoint. All money     */
/*  values are decimal strings straight from the server.               */
/* ------------------------------------------------------------------ */

export interface RefundRequestCustomer {
  id: string
  firstName: string
  lastName: string
  phone?: string | null
}

export interface RefundRequestAppointment {
  id: string
  scheduledStart?: string | null
  branchId?: string | null
  customer?: RefundRequestCustomer | null
}

/** The actor recorded on a review/completion (id + phone). */
export interface RefundRequestActor {
  id: string
  phone?: string | null
}

export interface RefundRequest {
  id: string
  appointmentId: string
  paymentId?: string | null
  requestedAmount: string
  /** Server-provided; `null` until the request is approved. */
  approvedAmount?: string | null
  status: RefundRequestStatus
  reason?: string | null
  rejectionReason?: string | null
  requestedAt: string
  reviewedAt?: string | null
  reviewedBy?: RefundRequestActor | null
  completedAt?: string | null
  completedBy?: RefundRequestActor | null
  /** Amount actually paid out, present once completed. */
  completedAmount?: string | null
  reference?: string | null
  note?: string | null
  appointment?: RefundRequestAppointment | null
}

/** `GET /businesses/{businessId}/refund-requests` query. */
export type RefundRequestListQuery = {
  status?: RefundRequestStatus
  page?: number
  limit?: number
}

export interface RefundRequestListResult {
  data: RefundRequest[]
  meta: PaginationMeta | null
}

/**
 * `GET /businesses/{businessId}/appointments/{appointmentId}/refundable`
 *
 * The server owns every amount. `refundable` is the ceiling for a new
 * refund request; the client never derives it.
 */
export interface RefundableAppointment {
  appointmentId: string
  originalAmount: string
  finalAgreedAmount: string
  finalized: boolean
  verifiedPaid: string
  outstanding: string
  refunded: string
  refundReserved: string
  refundable: string
  policyType: string
  refundPercentage: number
}

/** `POST /businesses/{businessId}/refund-requests` body. */
export interface CreateRefundRequestInput {
  appointmentId: string
  amount: number
  paymentId: string
  reason: string
}

/** `POST /businesses/{businessId}/refund-requests/:id/reject` body. */
export interface RejectRefundRequestInput {
  rejectionReason: string
}

/** `POST /businesses/{businessId}/refund-requests/:id/complete` body. */
export interface CompleteRefundRequestInput {
  amount: number
  reference: string
  note?: string
}
