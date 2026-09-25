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
  logoUrl: string | null;
  coverImageUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  description: string | null;
  aboutUs: string | null;
  website: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  telegramUrl: string | null;
  tiktokUrl: string | null;
  branches: Array<{
    id: string;
    name: string;
    address: string | null;
    email: string | null;
    timezone: string;
    phones: BranchPhone[];
  }>;
  serviceCategories: Array<{
    id: string;
    name: string;
    description: string | null;
    sampleWorks: Array<{
      id: string;
      url: string;
      name: string;
      description: string | null;
      serviceCategoryId: string;
    }>;
  }>;
}

/**
 * Fields accepted by PATCH /businesses/{id}/branding (§3.4).
 * Do NOT include address/phone/email — strict schema rejects them (§11.2).
 */
export type BrandingUpdateInput = Partial<{
  logoUrl: string | null;
  coverImageUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  description: string | null;
  aboutUs: string | null;
  website: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  telegramUrl: string | null;
  tiktokUrl: string | null;
}>;

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

export interface SampleWorkInput {
  name: string;
  url: string;
  description?: string;
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

export type CustomerStatus = 'ACTIVE' | 'ARCHIVED'

export interface CustomerPhone {
  id: string
  phone: string
  isPrimary: boolean
  // per §3.4 responses; may not be present on the create response
  label?: string | null
  isActive?: boolean
}

export interface Customer {
  id: string
  businessId: string
  firstName: string
  lastName: string
  status: CustomerStatus
  phones: CustomerPhone[]
  createdAt: string
  updatedAt?: string
}

// §12 enum reference — small unions worth having
export type RefundRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PaymentStatus = 'PAID' | 'VOIDED';
export type ReceiptStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type CustomerConfirmationStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'EXPIRED';
export type ActorType = 'USER' | 'SYSTEM';

// §7.2 — tighten if the server enumerates
export type CustomerCancellationPolicy = 'ALWAYS' | 'BEFORE_DEADLINE' | 'NEVER';

// §8.6 — publicId is required by the create schema
export interface SampleWorkInput {
  name: string
  url: string
  publicId: string
  description?: string
}

// types/api.ts (append)

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'EXPIRED'

export type BookingSource = 'ONLINE' | 'STAFF' | 'PHONE' | 'WALK_IN'

export interface AppointmentStaffRef {
  staffId: string
  firstName: string
  lastName: string
}

export interface Appointment {
  id: string
  businessId: string
  branchId: string
  customerId: string
  service: {
    id: string
    name: string
    durationMinutes: number
    price: string
  }
  staff: AppointmentStaffRef[]
  scheduledStart: string  // ISO UTC
  scheduledEnd: string    // ISO UTC
  status: AppointmentStatus
  bookingSource: BookingSource
  totalAmount: string     // Decimal → string
  depositAmount: string | null
  notes: string | null
  internalNotes: string | null
  checkedInAt?: string | null
  confirmedAt?: string | null
  inProgressAt?: string | null
  completedAt?: string | null
  cancelledAt?: string | null
  noShowAt?: string | null
}


export interface AppointmentStatusHistoryEntry {
  id: string
  appointmentId: string
  statusFrom: AppointmentStatus | null
  statusTo: AppointmentStatus
  actorId: string | null
  actorType: 'USER' | 'SYSTEM'
  reason: string | null
  transitionTimestamp: string
  actor?: { id: string; phone: string } | null
}

export interface ServiceUsage {
  id: string
  appointmentId: string
  businessId: string
  branchId: string
  serviceId: string | null
  serviceName: string
  serviceDetails: string | null
  productsUsed: Array<{ name: string; quantity: number; unit: string }> | null
  notes: string | null
  recordedById: string
  recordedAt: string
}

export interface AppointmentPayment {
  id: string
  appointmentId: string
  businessId: string
  branchId: string
  paymentMethodId: string
  paymentMethod?: { name: string; type: string } | null
  amount: string
  status: 'PAID' | 'VOIDED'
  reference: string | null
  notes: string | null
  recordedById: string
  paidAt: string
}