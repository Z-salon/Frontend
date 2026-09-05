export type AppView        = 'auth' | 'onboarding' | 'app'
export type AuthScreen     = 'login' | 'signup' | 'forgot' | 'reset' | 'verify'
export type CalendarView   = 'day' | 'week' | 'list'
export type EntityStatus   = 'active' | 'inactive'
export type NavSection     =
  | 'bookings' | 'dashboard' | 'customers' | 'services'
  | 'staff'    | 'branches'  | 'feedback'  | 'finance' | 'settings'

export type AppointmentStatus =
  | 'pending' | 'confirmed' | 'checked-in' | 'in-progress'
  | 'completed' | 'cancelled' | 'no-show'

export type ServiceDepositType      = 'none' | 'fixed' | 'percentage' | 'full'
export type ServiceEmployeeAssign   = 'customer-chooses' | 'salon-assigns' | 'any-available'

export interface Service {
  id: string
  name: string
  category: string
  description?: string
  price: number
  duration: number
  buffer?: number
  showPrice: boolean
  depositType?: ServiceDepositType
  depositValue?: number
  employeeAssignment?: ServiceEmployeeAssign
  staffIds?: string[]
  branchIds?: string[]
  status?: EntityStatus
}

export interface StaffMember {
  id: string
  name: string
  role: string
  initials: string
  phone?: string
  email?: string
  branchIds?: string[]
  serviceIds?: string[]
  rating?: number
  appointmentCount?: number
  status?: EntityStatus
  workingHours?: { day: string; open: boolean; from: string; to: string }[]
}

export interface Branch {
  id: string
  name: string
  address: string
  phone?: string
  email?: string
  staffIds?: string[]
  serviceIds?: string[]
  status?: EntityStatus
  hours?: { day: string; open: boolean; from: string; to: string }[]
  todayAppointments?: number
}

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  dob?: string
  notes?: string
  visitCount?: number
  totalSpent?: number
  lastVisit?: string
  outstandingBalance?: number
}

export interface FeedbackItem {
  id: string
  customerId?: string
  customerName?: string
  staffId: string
  staffName: string
  serviceId: string
  serviceName: string
  branchId: string
  branchName: string
  date: string
  overallRating: number
  staffRating: number
  experienceRating: number
  hygieneRating: number
  waitingRating: number
  serviceQualityRating: number
  comment?: string
  anonymous: boolean
  reviewed: boolean
  internalNote?: string
}

export type TransactionType = 'revenue' | 'expense' | 'refund' | 'adjustment'
export type PaymentStatus  = 'paid' | 'partial' | 'unpaid'

export interface Transaction {
  id: string
  date: string
  type: TransactionType
  description: string
  category?: string
  customerId?: string
  customerName?: string
  staffId?: string
  staffName?: string
  serviceId?: string
  serviceName?: string
  branchId: string
  branchName: string
  paymentMethod: string
  amount: number
  amountPaid?: number
  paymentStatus?: PaymentStatus
  relatedAppointmentId?: string
  notes?: string
  createdBy: string
  createdAt: string
  history?: { action: string; by: string; at: string; reason?: string }[]
}

export interface ExpenseCategory {
  id: string
  name: string
  active: boolean
}

export interface PaymentMethod {
  id: string
  name: string
  active: boolean
}

export interface AppSettings {
  bookingConfirmation: 'automatic' | 'manual'
  minBookingNotice: number
  maxAdvanceBooking: number
  cancellationDeadline: number
  allowRescheduling: boolean
  currency: string
  feedbackEnabled: boolean
  feedbackRequestTiming: string
  anonymousFeedbackEnabled: boolean
  notifyAppointmentReminders: boolean
  notifyBookingNotifications: boolean
  notifyCancellations: boolean
  notifyFeedbackRequests: boolean
}

export interface Appointment {
  id: string
  customerId: string
  customerName: string
  customerPhone: string
  serviceId: string
  serviceName: string
  staffId: string
  staffName: string
  branchId: string
  branchName: string
  date: string
  startTime: string
  duration: number
  price: number
  deposit?: number
  paymentStatus: 'unpaid' | 'deposit-paid' | 'paid'
  status: AppointmentStatus
  notes?: string
  isWalkIn?: boolean
  customTitle?: string
}
