# Patient Portal Roadmap

## Data platform va public deployment (dang thuc hien)

- [x] Reporting schema PostgreSQL.
- [x] On-demand sync theo `MABN` qua worker nen.
- [x] Cache TTL, deduplicate job va API sync status.
- [x] Docker Compose public voi HTTPS va private network.
- [ ] Khoi dong PostgreSQL local va test dong bo that (Docker Desktop dang khong start duoc).
- [ ] Upsert normalized theo `MABN -> MAVAOVIEN -> MAQL` thay cho snapshot chuyen tiep.
- [ ] Queue ben vung cho multi-instance (`SKIP LOCKED`/RabbitMQ).
- [ ] WAF/rate limit, audit, monitoring, backup va pentest truoc go-live.

## Current Priority: Reporting DB + On-demand Sync

### Architecture Decision
- Portal will not query the primary HIS database directly in the long-term request path.
- PatientApi should read from a Portal Reporting DB.
- A Sync Worker reads Oracle HIS with a read-only account and limited concurrency.
- Sync is on-demand by patient: only patients who log in or open data trigger sync.
- Data model must preserve HIS identity hierarchy: `MABN -> MAVAOVIEN -> MAQL -> orders/results/prescriptions`.

### Doing Next
- Create Portal Reporting DB/schema from `docs/sql/portal_schema_draft.sql`.
- Implement `portal_sync_state` and `portal_sync_jobs`.
- Add worker service for `patient_profile`, `identity`, `insurance`, and `encounter_list`.
- Change PatientApi request path to read reporting DB first and enqueue sync when data is stale/missing.
- Keep Oracle direct reads only as temporary migration fallback.

## Previous Priority: Mobile UX Sprint

### Done
- Mobile-first shell with bottom navigation.
- Dashboard has compact greeting, digital BHYT card, shortcut grid, and external booking CTA.
- Dashboard no longer duplicates the `Khám hôm nay` shortcut inside the grid; primary access is the top CTA and bottom tab.
- Dashboard separates neutral statistic badges from amber/red attention badges.
- Today visit module reads `TIEPDON` and `V_CHIDINH`.
- `TIEPDON.DONE = '?'` maps to `Đang khám`; if there are same-day CLS orders, progress becomes `Đang thực hiện cận lâm sàng`.
- Today visit also treats same-day CLS records as an active visit when `TIEPDON` is missing or cannot be matched.
- Today visit progress tracker shows available timestamps from registration, CLS order, CLS start, and latest result.
- Visit detail keeps lab/imaging results collapsed and lab results use a 4-column table.
- Visit history cards include a clear `Xem chi tiết` affordance.
- Visit detail pages include a clear back action to visit history.
- Prescriptions are separated into `Đơn thuốc BHYT` and `Đơn thuốc thu phí`.

### Remaining UX Work
- Validate the mobile dashboard and Today visit flow with several real patients, especially patients with CLS but no matched `TIEPDON`.
- Review all Vietnamese strings that still show mojibake in source or UI and normalize to UTF-8 where needed.
- Tighten History filter UI into Vietnamese-friendly date display (`dd/mm/yyyy`) instead of native browser `mm/dd/yyyy`.
- Keep header/back navigation consistent on every child/detail/filter screen.

## Next Sprint
- Notification center:
  - upcoming appointment reminders
  - new lab/imaging result notices
  - BHYT expiry reminders
- Queue polling if HIS exposes current called number by department/room.
- PDF export for lab results and prescriptions.
- Multi-profile family account support.

## Later
- Internal booking flow: department, doctor, time slot.
- Online payment and billing lookup.
- Medication reminders.
- Dark mode.
- AI assistant with strict administrative guidance and medical disclaimers.
- Health record interoperability / national health identifier integration.

## Design Rules
- Alert badges use amber/red and only mean action needed or new important information.
- Statistic counts use neutral/chip style and should not look like unread notifications.
- Dashboard should avoid duplicate navigation targets.
- Patient-facing lists should hide dense ICD details by default and link to detail pages.
- Mobile pages must avoid horizontal overflow at 390px viewport.
