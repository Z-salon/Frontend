You are continuing development of the existing Z-salon frontend prototype.

IMPORTANT:
This is NOT a new project.

The existing frontend has already been implemented for:

- Z-salon brand and design system
- Authentication
- Salon onboarding
- Business setup
- Branch setup foundation
- Opening hours
- Booking settings
- Service setup foundation
- Booking calendar
- Appointment management
- New booking
- Walk-in appointments
- Custom appointments
- Appointment status management

Your task now is to add:

PART 3:
Services Management
Staff Management
Branch Management

PART 4:
Customers / Simple CRM
Feedback Management

Do NOT rebuild the existing application.


==================================================
CRITICAL RULE — PROTECT EXISTING WORK
==================================================

DO NOT modify, rewrite, replace, delete, or redesign existing files/components unless it is absolutely necessary to integrate the new functionality.

Before making changes:

1. Inspect the existing project structure.
2. Identify the existing design system.
3. Identify reusable components.
4. Identify existing routing/navigation.
5. Identify existing booking/onboarding components.
6. Reuse them.

Do NOT create a second design system.

Do NOT introduce a new color palette.

Do NOT replace existing typography.

Do NOT redesign the sidebar.

Do NOT redesign the booking page.

Do NOT redesign the authentication flow.

Do NOT redesign onboarding.

Do NOT rewrite existing components simply because you would implement them differently.

If an existing component already solves the problem, reuse it.

Only create new components/pages required for the features in this prompt.

If an existing file needs a very small change for navigation or integration, make the smallest possible change.

Preserve all existing functionality.

After implementation, all previously completed flows must continue working.


==================================================
Z-SALON DESIGN SYSTEM
==================================================

Continue using the existing Z-salon visual identity.

Brand:

Z-salon
ዘsalon

Core colors:

Background:
#F6F4F0

Primary text / buttons:
#1C1C1C

Cards / secondary surfaces:
#C7B9AD

The visual style must remain:

- Premium
- Elegant
- Minimal
- Calm
- Spacious
- Luxurious
- Professional

Think:

Luxury salon + premium business software.

Do NOT make these modules look like generic SaaS admin pages.

Use the existing typography, spacing, buttons, cards, forms, tables, modals, drawers, badges, icons, and interaction patterns already established in the project.

==================================================
PART 3
SERVICES, STAFF & BRANCHES
==================================================


# 1. SERVICES MANAGEMENT

The salon's services are the foundation of the booking system.

Create a dedicated:

Services

page.

The page should contain:

Header:

Services

"Manage the services your salon offers."

Primary action:

+ Add Service


--------------------------------------------------
SERVICE LIST
--------------------------------------------------

Display services using an elegant table or card/list layout consistent with the existing design.

Example:

Hair

Haircut
250 ETB
30 min

Hair Coloring
1,500 ETB
90 min

Hair Treatment
2,500 ETB
120 min

Nails

Manicure
800 ETB
45 min

Gel Manicure
1,200 ETB
60 min

Makeup

Makeup
1,500 ETB
60 min

Show useful information:

- Service name
- Category
- Price
- Duration
- Buffer
- Availability
- Status


--------------------------------------------------
SERVICE CATEGORIES
--------------------------------------------------

Allow services to belong to categories.

Examples:

Hair
Nails
Makeup
Skin
Barber
Other

Allow:

+ Add Category

Category names should be customizable.

Do not hardcode salon categories as a fixed system.

A salon should be able to create its own categories.


--------------------------------------------------
CREATE SERVICE
--------------------------------------------------

Create a polished Add Service form.

Fields:

Service name

Category

Description

Price

Duration

Buffer time

Show price to customers

Deposit requirement

Employee assignment

Branches where service is available

Active / inactive


Example:

Hair Treatment

Category:
Hair

Price:
2,500 ETB

Duration:
2 hours

Buffer:
15 minutes

Show price to customers:
ON

Deposit:
500 ETB

Employee assignment:

○ Customer chooses
○ Salon assigns
○ Any available employee


--------------------------------------------------
PRICE VISIBILITY
--------------------------------------------------

This is an important customization.

Allow:

Show price to customers
ON / OFF

If OFF:

The service can still have an internal price used by the salon, but the customer-facing booking experience should not display the price.

The frontend prototype should visually demonstrate this configuration.


--------------------------------------------------
DEPOSIT SETTINGS
--------------------------------------------------

For each service:

No deposit

OR

Fixed amount

OR

Percentage

OR

Full payment

Example:

Haircut
No deposit

Hair Coloring
500 ETB deposit

Bridal Package
30% deposit


--------------------------------------------------
SERVICE DURATION
--------------------------------------------------

Every service should have:

Duration

Optional buffer time

Example:

Hair Treatment
120 min service
15 min buffer

The UI should explain that buffer time helps prevent appointments from being scheduled too closely together.


--------------------------------------------------
EMPLOYEE ASSIGNMENT
--------------------------------------------------

Each service supports:

1. Customer chooses employee

2. Salon assigns employee

3. Any available employee

This configuration must integrate conceptually with Staff and Booking.

For example:

Hair Coloring

Qualified staff:
Sara
Meron

Hana should not appear as an available employee if she is not assigned to that service.


--------------------------------------------------
SERVICE DETAIL
--------------------------------------------------

Clicking a service should open a detail page or drawer.

Show:

Service name
Description
Category
Price
Duration
Buffer
Deposit
Employee assignment
Qualified staff
Available branches
Customer price visibility
Status

Actions:

Edit
Deactivate
Delete


--------------------------------------------------
SERVICE STATUS
--------------------------------------------------

Support:

Active
Inactive

Inactive services should not be available for new customer bookings.

Existing appointments using an inactive service should remain visible.


==================================================
# 2. STAFF MANAGEMENT
==================================================

Create:

Staff

page.

The purpose is to allow the salon owner to manage employees who perform services and receive appointments.


--------------------------------------------------
STAFF LIST
--------------------------------------------------

Use elegant staff cards or a clean table.

Example:

Sara
Hair Stylist
★ 4.8
Bole

Hana
Nail Artist
★ 4.6
Bole

Meron
Makeup Artist
★ 4.7
Kazanchis


Show:

Profile image/avatar
Name
Role
Branch
Rating
Status


--------------------------------------------------
ADD STAFF
--------------------------------------------------

Fields:

Full name

Phone

Email (optional)

Role / position

Profile photo

Branch

Services they can perform

Working hours

Status


Example:

Sara

Role:
Hair Stylist

Branches:
✓ Bole
✓ Kazanchis

Services:

✓ Haircut
✓ Hair Coloring
✓ Hair Treatment

✗ Manicure


--------------------------------------------------
STAFF-SERVICE RELATIONSHIP
--------------------------------------------------

This is critical.

The system must visually represent:

Which services each staff member can perform.

Example:

Sara:

✓ Haircut
✓ Hair Coloring
✓ Hair Treatment

Hana:

✓ Manicure
✓ Gel Manicure
✓ Nail Extension

Meron:

✓ Makeup
✓ Bridal Makeup


This relationship should affect the booking UI.

When booking:

Hair Coloring

Only qualified staff should appear.


--------------------------------------------------
WORKING HOURS
--------------------------------------------------

Each staff member can have their own working schedule.

Example:

Sara

Monday
09:00 – 17:00

Tuesday
09:00 – 17:00

Wednesday
09:00 – 17:00

Thursday
09:00 – 17:00

Friday
09:00 – 17:00

Saturday
10:00 – 15:00

Sunday
Off


Allow:

Working
Off


--------------------------------------------------
STAFF DAYS OFF
--------------------------------------------------

Allow the admin to configure days when staff are unavailable.

Example:

Sara
Vacation
Aug 25 – Aug 28


The UI should show this as unavailable time.

No need to build a complex scheduling engine.


--------------------------------------------------
STAFF STATUS
--------------------------------------------------

Support:

Active
Inactive

Inactive staff should not be selectable for new appointments.

Historical appointments should remain visible.


--------------------------------------------------
STAFF DETAIL
--------------------------------------------------

Staff profile:

Sara
Hair Stylist

Rating:
4.8 ★

Appointments:
142

Services:
Haircut
Hair Coloring
Hair Treatment

Branches:
Bole
Kazanchis

Working Hours

Upcoming appointments

Recent feedback

Do not build advanced analytics yet.


==================================================
# 3. BRANCH MANAGEMENT
==================================================

Create:

Branches

page.

This is for salons with multiple locations.

Example:

Z-salon

Bole
Kazanchis
CMC


--------------------------------------------------
BRANCH LIST
--------------------------------------------------

Display:

Branch name
Location
Phone
Opening hours
Staff count
Today's appointments
Status


Example:

Bole

Open

24 appointments today

12 staff

Kazanchis

Open

17 appointments today

8 staff


--------------------------------------------------
ADD BRANCH
--------------------------------------------------

Fields:

Branch name

Address

Phone

Email

Opening hours

Status


Example:

Bole

Bole Road
Addis Ababa

+251 9XX XXX XXX


--------------------------------------------------
BRANCH OPENING HOURS
--------------------------------------------------

Allow:

Monday – Sunday

Open / Closed

Opening time
Closing time

The branch schedule should conceptually affect booking availability.


--------------------------------------------------
BRANCH STAFF
--------------------------------------------------

Each branch should show its assigned staff.

Example:

Bole

Sara
Hana
Meron

Allow:

+ Assign Staff


--------------------------------------------------
BRANCH SERVICES
--------------------------------------------------

Each branch can have available services.

Example:

Bole:

Haircut
Hair Coloring
Manicure

Kazanchis:

Haircut
Makeup
Gel Manicure


Allow the admin to configure which services are offered at each location.


--------------------------------------------------
BRANCH DETAIL
--------------------------------------------------

Show:

Branch information
Opening hours
Staff
Services
Today's appointments
Branch booking availability

Actions:

Edit
Deactivate


==================================================
PART 4
CUSTOMERS & SIMPLE CRM
==================================================


# 4. CUSTOMER MANAGEMENT

Create:

Customers

page.

This is intentionally a SIMPLE CRM.

Do NOT build a complex CRM.

The purpose is to help salon owners know:

Who their customers are
What services they receive
Their appointment history
Their outstanding balances
Their feedback


--------------------------------------------------
CUSTOMER LIST
--------------------------------------------------

Display:

Name
Phone
Visits
Last visit
Total spent
Outstanding balance

Example:

Hana
+251 9XX XXX XXX
14 visits
Aug 15
5,400 ETB
0 ETB

Sara
+251 9XX XXX XXX
8 visits
Aug 12
3,200 ETB
500 ETB


Add:

Search customers

Filters:

Branch
Last visit
Outstanding balance


--------------------------------------------------
ADD CUSTOMER
--------------------------------------------------

Fields:

Full name

Phone

Email (optional)

Date of birth (optional)

Notes (optional)


Do NOT require too much information.

The salon should be able to create a customer quickly during:

New booking

Walk-in

Customer management


--------------------------------------------------
CUSTOMER PROFILE
--------------------------------------------------

Create a premium customer profile.

Header:

Customer name

Phone

Optional avatar

Summary metrics:

Visits
Total spent
Outstanding balance
Average rating


Tabs:

Overview
Appointments
Payments
Feedback
Notes


--------------------------------------------------
CUSTOMER OVERVIEW
--------------------------------------------------

Show:

Upcoming appointment

Last appointment

Favorite services

Visit frequency

Outstanding balance

Recent activity


Example:

Hana

14 Visits
5,400 ETB Spent
0 ETB Outstanding

Upcoming:

Hair Treatment
Aug 20
2:00 PM
Bole


--------------------------------------------------
APPOINTMENT HISTORY
--------------------------------------------------

Show:

Date
Service
Staff
Branch
Amount
Status


Example:

Aug 15
Hair Treatment
Sara
Bole
2,500 ETB
Completed


--------------------------------------------------
CUSTOMER NOTES
--------------------------------------------------

Allow admin to create internal notes.

Example:

"Prefers afternoon appointments."

"Usually books Sara."

These are private salon notes.

Do not expose these to customers.


--------------------------------------------------
CUSTOMER SEARCH / DUPLICATE PREVENTION
--------------------------------------------------

When creating a customer:

If the phone number already exists, show:

"Customer already exists."

Allow the admin to select the existing customer.

This should prevent obvious duplicate customers.

Use mock frontend logic.


==================================================
# 5. FEEDBACK MANAGEMENT
==================================================

Feedback is PRIVATE.

This is a critical product requirement.

All feedback is:

ADMIN ONLY.

Customers do NOT see other customers' feedback.

Staff do NOT see private feedback unless explicitly provided by a future permission system.

Do NOT create public reviews.


--------------------------------------------------
FEEDBACK DASHBOARD
--------------------------------------------------

Create:

Feedback

page.

Header:

Customer Feedback

"Private feedback from your customers."

Add visible label:

PRIVATE • ADMIN ONLY


--------------------------------------------------
FEEDBACK METRICS
--------------------------------------------------

Show:

Average rating
4.6 ★

Total feedback
183

Staff rating
4.7 ★

Overall experience
4.4 ★


These should use elegant metric cards consistent with the existing design.


--------------------------------------------------
STAFF PERFORMANCE
--------------------------------------------------

Show average rating per staff member.

Example:

Sara
★★★★★
4.8

Hana
★★★★☆
4.6

Meron
★★★★☆
4.1


Allow filtering by:

Branch
Staff
Service
Date range


--------------------------------------------------
EXPERIENCE CATEGORIES
--------------------------------------------------

Feedback can include:

Staff service

Overall experience

Hygiene

Waiting time

Service quality

Use simple charts or visual summaries.

Example:

Staff Service
4.8 ★

Hygiene
4.5 ★

Waiting Time
3.9 ★


Do not create excessive analytics.


--------------------------------------------------
FEEDBACK LIST
--------------------------------------------------

Display:

Rating
Customer
Staff
Service
Branch
Date
Comment
Status


Example:

★★★★★

Hana

Hair Treatment
Sara
Bole

Aug 16

"Really loved the service. Sara was very professional."


If anonymous:

★★★★★

Anonymous

Hair Treatment
Sara
Bole

Aug 16


--------------------------------------------------
FEEDBACK DETAIL
--------------------------------------------------

Click feedback.

Open a drawer or detail page.

Show:

Overall rating

Staff rating

Experience rating

Category ratings

Comment

Customer

Staff

Service

Branch

Date

Anonymous status


Add:

Mark as reviewed

Internal note


Example:

Feedback:

★★★★★

Staff:
★★★★★

Experience:
★★★★☆

Hygiene:
★★★★★

Waiting time:
★★★☆☆


Comment:

"Everything was lovely. The waiting time was a little long."


Internal note:

[.................................]

[Save Note]


==================================================
# 6. FEEDBACK RELATIONSHIP WITH CUSTOMERS
==================================================

Feedback should appear in the Customer profile.

Customer:

Hana

Tabs:

Overview
Appointments
Payments
Feedback
Notes


Feedback tab:

Aug 16
Hair Treatment
Sara
★★★★★

"Really loved the service."


This allows the salon owner to understand the customer's history.


==================================================
# 7. FEEDBACK RELATIONSHIP WITH STAFF
==================================================

Feedback should also appear in the Staff profile.

Example:

Sara

Rating:
4.8 ★

Recent feedback:

★★★★★
"Very professional."

★★★★★
"Excellent service."

Do not give staff a separate staff-facing login or permission system.

This is still admin-only.


==================================================
# 8. MOCK FEEDBACK FLOW
==================================================

Do not implement Telegram or real customer messaging.

Instead, simulate feedback data.

Create realistic examples:

★★★★★
"Absolutely loved the service."

★★★★☆
"Great service, but there was a little waiting."

★★★★★
"Sara was very professional."

★★★☆☆
"The appointment started late."


==================================================
# 9. NAVIGATION INTEGRATION
==================================================

Add these existing/new pages to the current navigation:

Services
Staff
Branches
Customers
Feedback

Do NOT change the visual design of the existing sidebar.

Use the existing navigation component.

Bookings must continue working exactly as before.


==================================================
# 10. CROSS-MODULE RELATIONSHIPS
==================================================

The frontend should demonstrate that the modules are connected.

Example:

SERVICE
↓
Qualified STAFF
↓
Available BRANCH
↓
BOOKING
↓
CUSTOMER
↓
FEEDBACK


Example:

Hair Treatment

Available branches:
Bole
Kazanchis

Qualified staff:
Sara
Meron

Customer:
Hana

Appointment:
Aug 20 · 2:00 PM

Feedback:
★★★★★


Use mock/local state to simulate these relationships.


==================================================
# 11. IMPORTANT FRONTEND BEHAVIOR
==================================================

This remains a frontend prototype.

Use mock data and local state.

Interactions should feel real.

Examples:

Create service
→ service appears in list.

Edit service
→ updated information appears.

Assign service to staff
→ staff profile updates.

Assign staff to branch
→ branch staff list updates.

Create customer
→ customer appears in customer list.

Create booking
→ customer appointment history updates.

Change appointment
→ customer profile reflects it.

Open feedback
→ feedback appears in customer/staff profile.

Do not implement backend APIs.


==================================================
# 12. RESPONSIVE DESIGN
==================================================

Continue the existing responsive behavior.

Prioritize:

1440px
1280px
1024px

The admin interface should remain usable at smaller widths.

Do not redesign the mobile experience from scratch.


==================================================
# 13. EMPTY / LOADING / ERROR STATES
==================================================

Every new page should have appropriate states.

Services:

"No services yet."
"Add your first service."

Staff:

"No staff members yet."
"Add your team."

Branches:

"No branches yet."
"Add a branch."

Customers:

"No customers yet."
"Customers will appear here after their first booking."

Feedback:

"No feedback yet."
"Customer feedback will appear here after completed appointments."


==================================================
# 14. DO NOT BUILD
==================================================

Do NOT implement:

Finance
Accounting
Inventory
Payroll
Staff commissions
Tax
Advanced reporting
Marketing
Loyalty
Memberships
Gift card management
Payment gateways
Telegram integration
Google Reviews
Customer-facing booking website
Staff-facing dashboard
Customer-facing feedback portal
Backend
Database
API integration
Real authentication


==================================================
# 15. FINAL QUALITY REQUIREMENT
==================================================

Before finishing:

Test the existing application.

Verify:

Authentication still works.

Onboarding still works.

Booking still works.

Walk-in still works.

Custom appointment still works.

Existing design system remains unchanged.

Then test the new flows:

Services
→ Create/Edit/View

Staff
→ Create/Edit/View
→ Assign services

Branches
→ Create/Edit/View
→ Assign staff/services

Customers
→ Create/Edit/View
→ View appointments

Feedback
→ View
→ Filter
→ Detail
→ Customer profile
→ Staff profile


IMPORTANT:

Do not "clean up" or refactor existing files unnecessarily.

Do not replace working components.

Do not modify existing UI just for stylistic preference.

The objective is to EXTEND the existing Z-salon prototype while preserving everything that has already been built.


FINAL RESULT:

The owner should now be able to understand this product journey:

Sign up
↓
Set up salon
↓
Configure branches
↓
Configure services
↓
Add staff
↓
Assign staff to services
↓
Receive/manage bookings
↓
Register customers
↓
See customer history
↓
Review private customer feedback

The result should feel like ONE cohesive premium product, not separate AI-generated pages.