You are building the frontend prototype for a premium salon management SaaS called:

Z-salon
ዘsalon

This is a FRONTEND-ONLY prototype.

The purpose of this prototype is to demonstrate the product to real salon owners and validate the concept before formal development.

Do NOT build backend functionality, real authentication, real payments, APIs, database integration, or production infrastructure.

Use realistic mock data and local frontend state where needed.

IMPORTANT:
Do not over-engineer this phase.
Do not build Finance, Feedback, CRM, Staff Management, Inventory, Payroll, Accounting, Reports, or other modules yet.

This phase focuses ONLY on:

1. Foundation / Design System
2. Authentication
3. Salon Onboarding & Setup
4. Booking Configuration
5. Booking & Appointment Management


==================================================
1. PRODUCT / BRAND DIRECTION
==================================================

Brand:

Z-salon
ዘsalon

The product should feel:

- Premium
- Elegant
- Minimal
- Modern
- Calm
- Luxurious
- Professional
- Spacious
- Easy to use

The product is for salon and beauty businesses, but should NOT feel overly feminine.

It should also work for:
- Beauty salons
- Hair salons
- Nail salons
- Barber shops
- Multi-service salons

Think:

"Luxury salon experience + professional business management software"

Do NOT make it look like a generic SaaS dashboard.

Avoid:
- Bright purple SaaS gradients
- Excessive colorful cards
- Excessive shadows
- Cartoon illustrations
- Overly rounded childish UI
- Dense enterprise dashboards


==================================================
2. BRAND COLORS
==================================================

Use this palette as the core design system:

Background:
#F6F4F0

Primary text / buttons:
#1C1C1C

Cards / secondary surfaces:
#C7B9AD

Use the colors consistently throughout the application.

Use very subtle neutral tones for:
- borders
- dividers
- disabled states
- secondary text

Semantic colors such as success, warning and error should be muted and elegant rather than bright.

Do NOT introduce many additional brand colors.


==================================================
3. TYPOGRAPHY
==================================================

Use a sophisticated typography hierarchy.

For the Z-salon brand and major display headings:
Use an elegant serif/display style.

For normal application UI:
Use a clean modern sans-serif.

The dashboard and forms must remain highly readable.

Do not use decorative/script fonts for normal UI text.

Typography should communicate:

Luxury
+ 
Professional software


==================================================
4. DESIGN PRINCIPLES
==================================================

Use:

- Generous whitespace
- Strong visual hierarchy
- Elegant typography
- Thin subtle borders
- Minimal shadows
- Large but controlled headings
- Clean tables
- Spacious forms
- Consistent 12–20px corner radius
- Simple line icons
- Subtle animations
- Smooth transitions

Avoid visual clutter.

The interface should feel expensive and intentional.

Every screen should have clear hierarchy:

Page title
Supporting description
Primary action
Content


==================================================
5. APPLICATION FOUNDATION
==================================================

Create the overall application structure.

Desktop-first admin application.

Main layout:

LEFT SIDEBAR

Z-salon logo / wordmark

Navigation:

Dashboard
Bookings
Customers
Services
Staff
Branches
Feedback
Finance

Settings

For this phase, only BOOKINGS should be functional.

Other navigation items can appear disabled or as placeholders if necessary, but do not build their functionality yet.

The sidebar should feel premium and minimal.

At the bottom:

Admin profile
Salon name
Settings
Logout


TOP BAR

Include:

Current page title / breadcrumb where appropriate

Branch selector

Notifications icon

Admin profile


==================================================
6. AUTHENTICATION
==================================================

Create a polished authentication experience.

Screens:

A. Welcome / Login

B. Sign Up

C. Forgot Password

D. Reset Password

E. Email verification / confirmation state

Authentication is frontend-only.

Use mock authentication state.

--------------------------------------------------
LOGIN
--------------------------------------------------

Design should feel like a premium brand introduction.

Show:

Z-salon
ዘsalon

"Manage your salon beautifully."

Fields:

Email
Password

Actions:

Log in

Forgot password?

Alternative:

Continue with Google

Also:

"Don't have an account?"
Create your salon

Do not overload the screen.

--------------------------------------------------
SIGN UP
--------------------------------------------------

Fields:

Full name
Email
Password
Confirm password

Button:

Create account

After successful mock signup:

→ Salon setup

--------------------------------------------------
FORGOT PASSWORD
--------------------------------------------------

Email field

Send reset link

Show a polished success state.

--------------------------------------------------
RESET PASSWORD
--------------------------------------------------

New password
Confirm password

Reset password

Then:

→ Login

--------------------------------------------------
AUTHENTICATION UX
--------------------------------------------------

Include:

Loading state
Validation state
Error state
Success state

But keep them visually elegant.


==================================================
7. FIRST-TIME SALON ONBOARDING
==================================================

After registration, the user must set up their salon.

The onboarding should feel simple and welcoming.

Do NOT create a huge complicated setup wizard.

Use approximately 5–7 steps.

Show progress:

Step 1 of 6

or a subtle progress indicator.


--------------------------------------------------
STEP 1 — BUSINESS INFORMATION
--------------------------------------------------

Title:

"Tell us about your salon"

Fields:

Salon name
Phone number
Email
Address

Example:

Z-salon
+251 9XX XXX XXX
hello@zsalon.com
Bole, Addis Ababa

CTA:

Continue


--------------------------------------------------
STEP 2 — BRANDING
--------------------------------------------------

Title:

"Make Z-salon yours"

Allow:

Upload logo

Brand color

The default brand palette should already use:

#F6F4F0
#1C1C1C
#C7B9AD

Show a live preview of the salon branding.

CTA:

Continue


--------------------------------------------------
STEP 3 — LOCATION / BRANCH
--------------------------------------------------

Title:

"Where do you operate?"

Options:

○ One location

○ Multiple locations

If one location:

Branch name
Address
Phone
Opening hours

If multiple locations:

Allow adding branches.

Example:

Bole
Kazanchis
CMC

Do not create complex branch management yet.

This is only initial setup.


--------------------------------------------------
STEP 4 — OPENING HOURS
--------------------------------------------------

Title:

"When are you open?"

Allow:

Monday
Tuesday
Wednesday
Thursday
Friday
Saturday
Sunday

Each day:

Open / Closed

Opening time
Closing time

Example:

Monday
09:00 — 18:00

Sunday
Closed

Keep this visually simple.


--------------------------------------------------
STEP 5 — BOOKING SETTINGS
--------------------------------------------------

Title:

"Set up your booking rules"

Settings:

Booking confirmation:

○ Automatically confirmed
○ Requires salon approval

Minimum booking notice:

Example:
2 hours

Maximum advance booking:

Example:
30 days

Cancellation:

Enabled / Disabled

Cancellation deadline:

Example:
4 hours

Rescheduling:

Enabled / Disabled

Do not make this overly technical.


--------------------------------------------------
STEP 6 — FIRST SERVICES
--------------------------------------------------

Title:

"Add your first services"

Allow the salon owner to create services.

Example:

Haircut
250 ETB
30 min

Hair Treatment
2,500 ETB
120 min

Gel Manicure
1,200 ETB
60 min

For each service:

Name
Category
Price
Duration

Also include:

"Show price to customers"

toggle.

This is important because some salons may not want to display prices publicly.

Allow:

+ Add another service

Keep this step lightweight.


--------------------------------------------------
FINAL STEP
--------------------------------------------------

Show a beautiful completion screen:

"Your salon is ready."

"Welcome to Z-salon."

Summary:

Salon
Branches
Services
Opening hours

CTA:

"Enter Z-salon"

This takes the owner to the booking dashboard.


==================================================
8. BOOKING MANAGEMENT
==================================================

After onboarding, the user enters the main admin application.

The first major module is:

BOOKINGS

This is the core MVP workflow.


==================================================
9. BOOKING DASHBOARD / CALENDAR
==================================================

Create a polished booking calendar.

Header:

Bookings

Description:

"Manage your appointments and daily schedule."

Primary action:

+ New Booking

Secondary action:

+ Walk-in


Filters:

Branch
Staff
Service
Status

Date navigation:

< Previous
Today
Next >

Views:

Day
Week
List

Default view:

Day


==================================================
10. DAILY CALENDAR
==================================================

Create a realistic salon schedule.

Example:

09:00
Haircut
Sara
250 ETB

10:00
Manicure
Hana
800 ETB

11:30
Hair Treatment
Sara
2,500 ETB

13:00
Makeup
Meron
1,500 ETB

14:30
Gel Manicure
Hana
1,200 ETB

Appointments should visually communicate:

Customer
Service
Staff
Time
Status

Use the brand palette and subtle status indicators.


==================================================
11. APPOINTMENT STATUS
==================================================

Support these statuses:

Pending
Confirmed
Checked in
In progress
Completed
Cancelled
No-show

Make status visually clear but subtle.

Example:

Confirmed
Completed
Cancelled
No-show

Use muted semantic colors.


==================================================
12. APPOINTMENT DETAIL
==================================================

Clicking an appointment opens a side panel or modal.

Show:

Customer
Phone
Service
Staff
Branch
Date
Start time
Duration
Price
Deposit
Payment status
Notes

Actions:

Confirm
Check in
Start service
Complete
Cancel
Reschedule
Mark as no-show

Also show appointment history where appropriate.


==================================================
13. NEW BOOKING
==================================================

Create a clean booking creation flow.

Title:

"New booking"

Fields:

Customer
Branch
Service
Staff
Date
Time

Then:

Price
Deposit
Payment status
Notes

Customer:

Search existing customer

Also:

+ New customer

Do not build the full CRM yet.

For the prototype, creating a customer can be a simple modal/form.


==================================================
14. STAFF ASSIGNMENT
==================================================

For every service, the onboarding/service configuration supports:

Customer chooses staff

OR

Salon assigns staff

OR

Any available staff

The booking UI should reflect this.

For example:

If "Customer chooses":

Staff selection is visible.

If "Salon assigns":

Staff can be assigned by admin.

If "Any available":

Show available staff/time slots.

Do NOT build a complicated scheduling algorithm.

Use realistic mocked availability.


==================================================
15. AVAILABLE TIME SLOTS
==================================================

Available times should visually consider:

Salon opening hours
Staff working hours
Existing appointments
Service duration
Buffer time

Example:

Hair Treatment
Duration: 2 hours
Buffer: 15 minutes

Available:

09:00
11:15
14:00
16:15

This can be mocked for the prototype.

The important thing is that the UI communicates:

"Availability is calculated rather than hardcoded."


==================================================
16. WALK-IN APPOINTMENT
==================================================

This is a critical part of the MVP.

Not every customer will book online.

Add:

"+ Walk-in"

Flow:

Customer

Existing customer:
Search customer

OR

New customer:
Create customer

Then:

Service
Staff
Price
Payment method

CTA:

Start appointment

After completion:

Mark completed

Record payment

Optionally:

Send feedback request

Do not implement the actual Telegram integration.


==================================================
17. CUSTOM / SPECIAL APPOINTMENT
==================================================

Some salon appointments won't fit a standard service.

Provide:

"+ Custom Appointment"

Fields:

Title
Customer
Branch
Date
Start time
Estimated duration
Staff
Price
Deposit
Notes

Example:

Bridal Photoshoot

Customer:
Hana

Date:
August 29

Start:
07:00

Duration:
5 hours

Staff:
Sara
Meron

Price:
10,000 ETB

Deposit:
2,000 ETB

Notes:
Bride + 2 bridesmaids

This should be a simple flexible appointment type.

Do NOT build separate modules for weddings, photoshoots, graduation, etc.


==================================================
18. RESCHEDULE
==================================================

When rescheduling:

Show current appointment.

Then:

New date
New time

Show available slots.

Confirm reschedule.

Use a confirmation state.


==================================================
19. EMPTY STATES
==================================================

Every important screen needs a polished empty state.

Examples:

No appointments today

"No appointments yet."

"Your schedule is clear."

CTA:

+ New Booking

For no customers:

"No customers yet."

For no services:

"Add your first service."


==================================================
20. MOCK DATA
==================================================

Create realistic mock data for the prototype.

Salon:

Z-salon

Branches:

Bole
Kazanchis

Staff:

Sara
Hana
Meron

Services:

Haircut
Hair Coloring
Hair Treatment
Manicure
Gel Manicure
Makeup
Bridal Package

Customers:

Hana
Meron
Sara
Liya
Betty

Use Ethiopian-style names and ETB pricing where appropriate.

Dates should look realistic.


==================================================
21. RESPONSIVE DESIGN
==================================================

Prioritize:

Desktop
Laptop

The admin dashboard should work well around:

1440px
1280px
1024px

Do not spend excessive time on mobile admin.

However, forms and important interactions should not break on smaller screens.


==================================================
22. COMPONENT CONSISTENCY
==================================================

Create reusable UI patterns.

Examples:

Button
Input
Select
Date picker
Modal
Drawer
Card
Table
Badge
Avatar
Tabs
Dropdown
Toast
Empty state
Confirmation dialog

Do not create visually different versions of the same component for different pages.

Reuse components consistently.


==================================================
23. INTERACTION QUALITY
==================================================

Even though this is a prototype, interactions should feel real.

Examples:

Click "Create Booking"
→ booking appears in calendar.

Click appointment
→ detail panel opens.

Click "Complete"
→ status changes to Completed.

Click "Walk-in"
→ walk-in flow opens.

Create service
→ service appears in service list.

Change booking settings
→ UI reflects the setting.

Use frontend mock/local state to simulate this behavior.


==================================================
24. IMPORTANT SCOPE RESTRICTIONS
==================================================

DO NOT BUILD YET:

Finance
Feedback
CRM beyond basic customer creation
Inventory
Payroll
Accounting
Tax
Advanced reporting
Staff commission
Marketing
Loyalty
Membership management
Payment gateway integration
Telegram integration
Google Review integration
AI features
Notifications infrastructure
Backend APIs
Database
Real authentication
Real email

These belong to later phases.

For now, focus on creating a highly polished frontend prototype for:

AUTH
→
SALON SETUP
→
BOOKING CONFIGURATION
→
BOOKING MANAGEMENT
→
WALK-IN
→
CUSTOM APPOINTMENTS


==================================================
25. MOST IMPORTANT DESIGN REQUIREMENT
==================================================

The finished result should NOT feel like an AI-generated template.

It should feel like a carefully designed premium product.

Prioritize:

Visual hierarchy
Whitespace
Typography
Consistency
Elegant interactions
Realistic salon workflows

Do not fill every empty space with cards.

Do not overuse rounded containers.

Do not use generic SaaS gradients.

Do not introduce random colors.

Do not create unnecessary pages.

The final prototype should be something I can open in front of a real salon owner and say:

"This is Z-salon. This is how you would manage your salon."

The owner should immediately understand:

1. How to set up their salon
2. How to configure their services and booking rules
3. How to see today's appointments
4. How to create a booking
5. How to handle a walk-in
6. How to reschedule/cancel/complete an appointment
7. How the system can adapt to different salon workflows