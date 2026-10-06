# Juniper Salon — waitlist concierge

A local Temporal prototype for Lena and Carla: offer cancelled appointments to eligible waitlisted clients, one at a time, with durable deadlines and no competing claims inside the demo.

## Run locally

Requires Node.js 20+ and Docker Desktop running. From the cloned repository folder, one command installs the locked dependencies and starts Temporal, the Worker, and the API:

```sh
npm start
```

Open http://localhost:3000. Inspect Temporal at http://localhost:8233.

```sh
npm run typecheck
npm test
npm run stop
```

## Demonstration

1. Add a Haircut opening with Lena, today at least an hour ahead, duration 60 minutes.
2. Select **Demo speed** for 15-second deadlines (normal mode uses 15 minutes).
3. Open the simulated client message. Decline or let it expire: the next matching client receives an offer automatically.
4. Accept the next offer: the opening becomes confirmed and the waitlist request is removed.
5. Reopen an expired offer: it cannot claim the opening. The API also rejects stale/duplicate replies and records them in history.
6. Create another opening and mark it unavailable: any outstanding offer is cancelled.
7. Use overlapping openings with different stylists to observe that each client can hold only one offer. Overlapping active/confirmed openings for the same stylist are rejected.

## Customer rules

Match service, availability covering the entire appointment, and any required stylist; prioritize oldest request. Use the opening's stylist and duration. Only existing waitlisted clients receive offers. One active offer per opening and per client. Declines and timeouts retain waitlist position; acceptance removes the request. Do not issue new offers with less than 15 minutes before the start. Late/duplicate/cancelled offers never create a booking. Staff see the current holder, responses, candidate snapshot and outcome.

## Temporal architecture

`src/workflows.ts` contains a long-lived salon coordinator Workflow. Temporal Updates serialize commands and return their outcome; Queries expose state. Durable timed conditions expire offers even with the browser closed. A single coordinator owns all reservations so concurrent acceptances and cross-opening client assignments share one authority. The Worker runs this code on `assessment-starter`; the API is a Temporal client. Docker stores Temporal history in a named volume, and Worker restarts recover workflow state from history.

The coordinator is deliberately small-scope: production would need bounded history/Continue-As-New, a persistent client store, authenticated staff/client access, and suitable workflow versioning. There are no external delivery Activities because messages are simulated in the UI; actual SMS and Square calls belong in Activities with idempotency and retry handling.

## Explicit simulations and assumptions

- No SMS is sent. Private offer links simulate messages; demo data is fictional. Links are not production authentication. The staff API is unauthenticated: local use only.
- Square is not read or updated. Acceptance confirms only in the demo; staff record the booking and any previous appointment change in Square. Staff must mark an opening unavailable if booked externally. No cross-system double-booking guarantee is claimed.
- Sample clients are available all day on the day the coordinator is first created. Local API timezone determines "today". Only same-day openings are accepted.
- Cancelling an offer stops outreach; marking unavailable stops outreach and cancels its offer. Accepted bookings must be handled in Square.
- If all otherwise eligible clients are busy with other offers, finish unfilled rather than wait; staff can create a new opening to retry.
- Simulated delivery always succeeds. Real delivery failure policy remains a customer follow-up.
- Demo speed changes only response timeout, not the 15-minute appointment cutoff.
- Waitlist creation/editing, production authentication, real integrations, and automatic rescheduling are excluded.

To reset sample data for a new day, stop the app and use `docker compose down -v` before restarting. **This deletes the local demo's Temporal history and bookings.**

Do not deploy publicly. Evaluators run the prototype locally.

## Submission artifacts

- [Temporal Web UI evidence](evidence/temporal-web-ui.png)
- [Five-slide presentation for Lena](presentation/juniper-salon.pdf)
- [Dashboard screenshot](evidence/juniper-dashboard.png)
