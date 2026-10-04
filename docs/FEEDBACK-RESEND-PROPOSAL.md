# Proposal — Feedback request resend (admin)

**Status:** proposed, not implemented.
**Affects:** §12 Feedback in `ENDPOINTS-GUIDE (2).md`.
**Motivation:** the admin UI cannot offer a customer their feedback link today.

---

## 1. Problem

The feedback lifecycle creates exactly one `FeedbackRequest` per appointment when the
appointment reaches `COMPLETED` (`UNIQUE(appointment_id)`), and delivers the link by
SMS, best-effort:

> The customer receives a link `«FRONTEND_URL»/feedback/{raw_token}` (SMS, best-effort).
> **The raw token is never stored or logged — only its SHA-256 hash is persisted.**

That design is correct and should stay. But it leaves three gaps:

1. **The SMS fails silently.** Best-effort means no retry path. If the gateway is down,
   or the number is temporarily unreachable, the request expires unsubmitted and nobody
   notices until someone reads the aggregate.
2. **Customers lose the link.** It arrives in SMS, not email or the customer account, so
   it is trivially lost — new phone, wiped thread, 7-day expiry.
3. **Admin has no recourse.** An admin looking at a `COMPLETED` appointment cannot see
   whether the request was delivered, and cannot produce the link again.

Today the only feedback endpoints are:

| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/v1/feedback/{token}` | public |
| `POST` | `/api/v1/feedback/submit` | public |
| `GET` | `/api/v1/businesses/{businessId}/feedback` | OWNER/ADMIN |
| `GET` | `/api/v1/businesses/{businessId}/feedback/{submissionId}` | OWNER/ADMIN |
| `POST` `GET` `PATCH` | feedback-categories | OWNER/ADMIN |

There is no way to mint, retrieve, or re-deliver a token.

**Explicitly rejected:** resolving the form by `appointmentId` instead of a token. The
token *is* the authorization mechanism for `GET /feedback/{token}`; accepting an
identifier would let anyone who can guess or enumerate a UUID read another customer's
feedback form. Do not add this.

---

## 2. Proposal

Add one OWNER/ADMIN endpoint that re-mints the token and re-delivers the link.

```
POST /api/v1/businesses/{businessId}/appointments/{appointmentId}/feedback-request/resend
```

### 2.1 Behaviour

1. Load the `FeedbackRequest` for `appointmentId`. `404 FEEDBACK_REQUEST_NOT_FOUND` if the
   appointment never reached `COMPLETED`, or `feedbackEnabled` was off at the time.
2. If the request is `SUBMITTED` → `409 FEEDBACK_ALREADY_SUBMITTED`. Do not resend; the
   customer has already answered and the response is in the admin list.
3. **Generate a new raw token.** Overwrite the stored hash with the new token's hash and
   set `expires_at = now() + 7 days`. The old link dies immediately — this is
   intentional, so a link shared in a group chat stops working once the customer asks for
   a fresh one.
4. Queue the SMS with the new link. Delivery is best-effort and reported separately, so
   a gateway failure surfaces as `200` with `delivered: false` rather than a 5xx.
5. Record a `FEEDBACK_REQUEST_RESENT` audit event with `appointmentId` only. Never write
   the raw token to audit metadata, consistent with §12.7.

### 2.2 Response

```json
{
  "success": true,
  "message": "Feedback request resent",
  "data": {
    "request_id": "uuid",
    "appointment_id": "uuid",
    "feedback_url": "https://frontend/feedback/<raw_token>",
    "delivered": true,
    "expires_at": "2026-10-09T10:00:00.000Z",
    "resend_count": 1
  }
}
```

`resend_count` lets the UI say "sent 3 times" and lets you rate-limit.

### 2.3 Errors

| Code | Condition |
|---|---|
| `404 FEEDBACK_REQUEST_NOT_FOUND` | no request exists (not completed, or was disabled) |
| `409 FEEDBACK_ALREADY_SUBMITTED` | already answered |
| `409 FEEDBACK_REQUEST_EXPIRED` | optional; only if you choose to forbid resend after expiry |
| `403` | caller is not OWNER/ADMIN |
| `429` | rate limited — propose max 3 resends per appointment per 24h |

### 2.4 Access control

OWNER/ADMIN only, matching §12.4. `BRANCH_MANAGER` and `STAFF` are denied: resending
reveals the customer's phone number's messaging channel and lets staff nudge customers
outside the agreed channel.

Consider also requiring `appointment.branch_id` to be in the caller's branch scope, which
the existing admin endpoints appear to apply.

---

## 3. Open questions for the backend

1. **Does resend reset `expires_at`, or extend from the original creation?** Resetting is
   simpler and matches "a week to respond to *this* request". The trade-off is that a
   determined customer can keep a link alive indefinitely.
2. **Should the old hash be invalidated immediately or after a grace period?** Immediate
   invalidation breaks a link that is mid-submission.
3. **Should resend be allowed after `EXPIRED`?** §12 currently treats `EXPIRED` as terminal
   in the MVP. Allowing resend from `EXPIRED` is the main fix for case 1 above, so it
   probably should be — but it changes the documented state machine.

---

## 4. Client impact

Already built, against this contract:

- `src/api/feedback.api.ts` — `resendAppointment(businessId, appointmentId)`
- `src/types/api.ts` — `FeedbackResendResult` (`delivered` and `resend_count` optional, so a
  partial response still renders)
- `src/hooks/useAppointmentFeedback.ts` — `resend()`, returning `true`/`false`/`null`
  (`null` = request failed, which the panel reports without blocking)
- `src/components/bookings/AppointmentPanel.tsx` — **Resend feedback link** button, shown
  only in the `awaiting` state (never once a response exists)

The button reads the returned `delivered` flag and distinguishes "sent" from "link created
but the SMS gateway refused it".

**Current behaviour:** the endpoint does not exist server-side, so this button returns 404
and surfaces *"Could not resend the feedback link."* It is wired and waiting, not working.
Retries should be rate-limited server-side per §2.3.