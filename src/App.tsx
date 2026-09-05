import { useState } from 'react'
import type {
  AppView, AuthScreen as AuthScreenType, NavSection, Appointment,
  Service, StaffMember, Branch, Customer, FeedbackItem,
  Transaction, ExpenseCategory, PaymentMethod, AppSettings,
} from './types'
import { AuthScreen }         from './components/auth/Auth'
import { OnboardingWizard }   from './components/onboarding/Onboarding'
import { AppShell }           from './components/layout/Shell'
import { BookingDashboard }   from './components/bookings/Dashboard'
import { AppointmentPanel }   from './components/bookings/AppointmentPanel'
import { NewBookingModal, WalkInModal } from './components/bookings/Modals'
import { ServicesPage }       from './components/services/ServicesPage'
import { StaffPage }          from './components/staff/StaffPage'
import { BranchesPage }       from './components/branches/BranchesPage'
import { CustomersPage }      from './components/customers/CustomersPage'
import { FeedbackPage }       from './components/feedback/FeedbackPage'
import { FinancePage }        from './components/finance/FinancePage'
import { DashboardPage }      from './components/dashboard/DashboardPage'
import { SettingsPage }       from './components/settings/SettingsPage'
import {
  initialAppointments, services as initialServices, staff as initialStaff,
  branches as initialBranches, customers as initialCustomers, initialFeedback,
  initialTransactions, expenseCategories as initialExpCats,
  paymentMethods as initialPayMethods, defaultAppSettings,
} from './data/mock'

export default function App() {
  const [appView,    setAppView]    = useState<AppView>('auth')
  const [authScreen, setAuthScreen] = useState<AuthScreenType>('login')
  const [navSection, setNavSection] = useState<NavSection>('dashboard')

  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments)
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [showNewBooking, setShowNewBooking] = useState(false)
  const [showWalkIn,     setShowWalkIn]     = useState(false)

  const [services,      setServices]      = useState<Service[]>(initialServices)
  const [staffList,     setStaffList]     = useState<StaffMember[]>(initialStaff)
  const [branches,      setBranches]      = useState<Branch[]>(initialBranches)
  const [customers,     setCustomers]     = useState<Customer[]>(initialCustomers)
  const [feedback,      setFeedback]      = useState<FeedbackItem[]>(initialFeedback)
  const [transactions,  setTransactions]  = useState<Transaction[]>(initialTransactions)
  const [expCats,       setExpCats]       = useState<ExpenseCategory[]>(initialExpCats)
  const [payMethods,    setPayMethods]    = useState<PaymentMethod[]>(initialPayMethods)
  const [appSettings,   setAppSettings]   = useState<AppSettings>(defaultAppSettings)

  // pending finance action from dashboard quick-actions
  const [pendingFinanceAction, setPendingFinanceAction] = useState(false)

  function updateAppointment(id: string, changes: Partial<Appointment>) {
    setAppointments(list => list.map(a => a.id === id ? { ...a, ...changes } : a))
    setSelectedAppt(cur => cur?.id === id ? { ...cur, ...changes } : cur)
  }

  function addAppointment(appt: Appointment) {
    setAppointments(list => [...list, appt])
  }

  function navigateTo(section: string) {
    setNavSection(section as NavSection)
  }

  function handleAddExpense() {
    setNavSection('finance')
    setPendingFinanceAction(true)
  }

  if (appView === 'auth') {
    return (
      <AuthScreen
        screen={authScreen}
        onNavigate={setAuthScreen}
        onLogin={() => { setAppView('onboarding') }}
        onSignup={() => { setAppView('onboarding') }}
      />
    )
  }

  if (appView === 'onboarding') {
    return <OnboardingWizard onComplete={() => setAppView('app')} />
  }

  function renderSection() {
    switch (navSection) {
      case 'dashboard':
        return (
          <DashboardPage
            appointments={appointments}
            customers={customers}
            feedback={feedback}
            transactions={transactions}
            branches={branches}
            onNavigate={navigateTo}
            onNewBooking={() => setShowNewBooking(true)}
            onWalkIn={() => setShowWalkIn(true)}
            onAddExpense={handleAddExpense}
          />
        )
      case 'services':
        return <ServicesPage services={services} staff={staffList} branches={branches} onUpdate={setServices} />
      case 'staff':
        return <StaffPage staff={staffList} services={services} branches={branches} feedback={feedback} onUpdate={setStaffList} />
      case 'branches':
        return <BranchesPage branches={branches} staff={staffList} services={services} onUpdate={setBranches} />
      case 'customers':
        return <CustomersPage customers={customers} appointments={appointments} feedback={feedback} onUpdate={setCustomers} />
      case 'feedback':
        return <FeedbackPage feedback={feedback} staff={staffList} branches={branches} onUpdate={setFeedback} />
      case 'finance':
        return (
          <FinancePage
            transactions={transactions}
            expenseCategories={expCats}
            paymentMethods={payMethods}
            customers={customers}
            onUpdateTransactions={setTransactions}
            onUpdateCategories={setExpCats}
            onUpdatePaymentMethods={setPayMethods}
            onUpdateCustomers={setCustomers}
            onNavigateToCustomer={id => { setNavSection('customers') }}
          />
        )
      case 'settings':
        return (
          <SettingsPage
            settings={appSettings}
            expenseCategories={expCats}
            paymentMethods={payMethods}
            onUpdateSettings={setAppSettings}
            onUpdateCategories={setExpCats}
            onUpdatePaymentMethods={setPayMethods}
            onLogout={() => setAppView('auth')}
          />
        )
      default:
        return (
          <div className="flex h-full overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <BookingDashboard
                appointments={appointments}
                onSelectAppointment={a => setSelectedAppt(prev => prev?.id === a.id ? null : a)}
                onNewBooking={() => setShowNewBooking(true)}
                onWalkIn={() => setShowWalkIn(true)}
                onUpdateAppointment={updateAppointment}
              />
            </div>
            {selectedAppt && (
              <AppointmentPanel
                appointment={selectedAppt}
                onClose={() => setSelectedAppt(null)}
                onUpdate={updateAppointment}
              />
            )}
          </div>
        )
    }
  }

  return (
    <AppShell activeSection={navSection} onNavigate={setNavSection}>
      {renderSection()}
      <NewBookingModal open={showNewBooking} onClose={() => setShowNewBooking(false)} onAdd={addAppointment} />
      <WalkInModal     open={showWalkIn}     onClose={() => setShowWalkIn(false)}     onAdd={addAppointment} />
    </AppShell>
  )
}
