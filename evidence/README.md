# Temporal evidence

`temporal-web-ui.png` captures the actual local Temporal Web UI for `juniper-salon-v1`, type `salonWorkflow`, on task queue `assessment-starter`.

The coordinator intentionally remains Running to manage future openings. `temporal-event-history.png` shows the event details. Its event history records completed command Updates and durable timers, including timers starting, firing, and being cancelled. A confirmed appointment is an internal opening outcome, not the completion of this long-lived coordinator.

All client names are fictional sample data. `juniper-dashboard.png` shows the staff interface after a sample booking.
