
Detailed Implementation Plan
Prepared in response to the VetOS Detailed Change Request

Document version: 1.0
Date: 28 August 2026
Source document: VetOS – Detailed Change Request (WhatsApp transcript)
Scope: Clinical / consultation module – Prescription, Vaccination, Deworming, Next Visit, Allergies, Food, Blood Test, and related Receptionist touchpoints
1. Executive Summary
This document translates the points raised in the VetOS Detailed Change Request into an actionable, module-wise implementation plan for the engineering and product teams. The change request centers on the doctor's clinical/consultation screen and its downstream links to the receptionist and medical-records modules. The core themes across all requested changes are: (a) faster, error-free data entry through search/autocomplete and quick-date selectors, (b) clearer visibility of what has already been entered (medicines, allergies), (c) proper separation of clinically distinct data — medicines, vaccines, deworming, food/accessories, and blood tests — into their own structured sections instead of being mixed together, and (d) laying the data foundation for future analytics (food consumption, reminders, offers).
The plan below is organized by feature module. Each module lists the current state, the required change, and the concrete frontend, backend, and data-model work needed, followed by acceptance criteria that QA can verify against. A cross-cutting section covers shared infrastructure (search service, date-calculation utility, linking framework) that multiple modules depend on, followed by a suggested phased rollout and a QA checklist.
2. Objectives
•	Reduce manual data-entry time and errors for doctors during consultation by introducing search-driven entry and quick-date selection.
•	Make previously-entered clinical data (medicines, allergies, vaccine history) immediately visible and verifiable on screen, not hidden behind a status label.
•	Cleanly separate Medicines, Vaccines, Deworming, Food/Accessories, and Blood Tests into distinct, purpose-built sections while keeping them linked to the same patient visit and medical record.
•	Surface clinically critical information (allergies) with strong visual prominence, positioned before vitals are even entered.
•	Reduce repetitive data entry for recurring/unchanged treatments via a Clone Treatment feature.
•	Establish a data model for Food & Accessories that is structured for future analytics — consumption tracking, reminders, and offers.
•	Ensure Next Visit / follow-up scheduling is consistent and visible across the Doctor, Receptionist, and Appointment modules.
3. Implementation Plan by Module
3.1. Prescription – Medicine Search, Entry & Visibility
Priority: High
Current State
Medicines are currently added from a long, unfiltered list with no type-ahead search. Once a medicine is added, the UI only shows a generic "Added" confirmation rather than listing the medicine itself, forcing the doctor to trust the system without visual confirmation.
Required Change
•	Add a type-ahead search/dropdown to the medicine entry field: as the doctor types, matching medicines are filtered and shown in a suggestion list.
•	Replace the generic "Added" toast/label with a persistent, itemized list of all added medicines directly beneath the entry field, showing name, dosage, frequency, and duration for each.
•	Extend the same search + visible-list pattern to a new "Animal Food & Accessories" entry option within the Prescription section, so food items and accessories can be searched and added the same way medicines are.
•	Add a "Previous History" link/button in the Prescription section that opens the patient's past visit records, prescriptions, and reports, so the doctor can check history without leaving the screen.
Frontend / UI Implementation
•	Build an autocomplete component (debounced input, min 2–3 characters, keyboard navigable) reusable for Medicines, Food, and Accessories.
•	Render the added-items list as editable rows (quantity/dosage/frequency inline-editable, delete icon) directly below the search box — no reliance on a transient toast.
•	Add an "Animal Food & Accessory" sub-tab or accordion inside the Prescription section using the same component.
•	Add a "View Previous History" button that opens a side panel or modal listing prior visits, prescriptions, and linked reports, deep-linked from the Medical Records module.
Backend / API Implementation
•	Expose a `GET /medicines/search?q=` endpoint (and equivalent `/food-items/search`, `/accessories/search`) with prefix/fuzzy matching against the master catalog, returning name, form, strength, stock status.
•	Expose `POST /prescriptions/{visitId}/items` to add a medicine/food/accessory line item; `PATCH`/`DELETE` for edit and removal.
•	Expose `GET /patients/{patientId}/history?type=prescriptions,reports` to power the previous-history panel, reusing the existing Medical Records API where possible.
•	Add DB indexing (e.g., trigram/GIN index or search-service index) on the medicine, food, and accessory catalogs to keep autocomplete latency low as the catalog grows.
Data Model Changes
•	Introduce a unified `prescription_items` table with a `item_type` column (`medicine` | `food` | `accessory`) instead of overloading the medicine table, each row linked to `visit_id` and `patient_id`.
•	Keep `medicine_master`, `food_master`, and `accessory_master` as separate lookup catalogs feeding the same search component.
Acceptance Criteria
•	Typing 3+ characters of a medicine name shows a filtered dropdown within an acceptable response time (target < 300ms).
•	Every added medicine/food/accessory appears as a visible line item immediately, with no dependency on remembering an "Added" toast.
•	Food and accessory items can be searched and added using the identical UX pattern as medicines.
•	Clicking "Previous History" surfaces prior prescriptions and linked reports for the same patient without navigating away from the consultation screen.
3.2. Vaccine Management – Categories & Separate Due Dates
Priority: High
Current State
Vaccination is currently tracked with a single "Next Vaccine Date" field with no distinction between vaccine types, so multiple vaccines due on different schedules cannot be tracked independently.
Required Change
•	Support three distinct vaccine-date fields: Next All-in-1 Vaccine, Next Anti-rabies Vaccine, and Next Kennel Cough Vaccine.
•	Keep Vaccines as a section separate from Deworming (not merged into one generic "immunization" block).
•	Within the Vaccine section, require a Vaccine Type dropdown to be selected first (from the three categories above, extensible for future types) before a due date is set.
Frontend / UI Implementation
•	Replace the single Next Vaccine Date input with a repeatable "Vaccine Record" block: Vaccine Type dropdown → Date Given → Next Due Date (auto-suggested, editable).
•	Show all three vaccine categories as separate rows/cards in the clinical page, each with its own status (Due / Upcoming / Overdue) badge.
•	Ensure the Vaccine section is visually and structurally distinct from the Deworming section (separate headers, separate cards).
Backend / API Implementation
•	Add a `vaccine_type` master table (seed with All-in-1, Anti-rabies, Kennel Cough; allow future additions via admin).
•	Create/extend `vaccinations` table with `patient_id`, `vaccine_type_id`, `date_given`, `next_due_date`, `visit_id`.
•	Expose `GET /patients/{id}/vaccinations` returning per-type latest and next-due dates for dashboard/reminder use.
Data Model Changes
•	`vaccine_type` (id, name, default_interval_days).
•	`vaccinations` (id, patient_id, vaccine_type_id, visit_id, date_given, next_due_date, created_by, created_at).
Acceptance Criteria
•	Doctor can independently record and view due dates for All-in-1, Anti-rabies, and Kennel Cough vaccines for the same patient.
•	Vaccine and Deworming remain visually and functionally separate sections.
•	Vaccine type must be selected before a due date can be saved.
3.3. Next Visit Date – Quick-Date Dropdown & Auto-Calculation
Priority: High
Current State
Next Visit Date is entered manually via a date picker with no shortcuts, and the follow-up is not consistently linked to the Appointment module or visible to the Receptionist.
Required Change
•	Add a quick-date dropdown next to Next Visit Date with options: Tomorrow, Day After Tomorrow, After 5 Days, After 7 Days, After 1 Month.
•	Selecting a quick-date option must automatically calculate and populate the actual calendar date in the Next Visit Date field (relative to the current/selected consultation date).
•	Link the Clinical Follow-up (Next Visit) data with the Appointment module so a follow-up automatically appears as a schedulable/visible entry there.
•	Surface the same follow-up information in the Receptionist section so front-desk staff can see and act on upcoming follow-ups without accessing the clinical screen.
Frontend / UI Implementation
•	Add a dropdown/select control beside the existing date field; selecting an option auto-fills the date field (still manually overridable).
•	On the Receptionist dashboard, add a "Follow-ups Due" widget/list sourced from the same follow-up records.
•	On the Appointment module, allow a follow-up record to be converted into a bookable appointment slot with one click.
Backend / API Implementation
•	Implement a shared date-calculation utility (see Section 4) exposed to the frontend or computed client-side using the visit date as the anchor.
•	Add `follow_up_type` (e.g., "next_visit") and store the computed date in `follow_ups` table linked to `visit_id`, `patient_id`, and optionally `appointment_id` once booked.
•	Expose `GET /receptionist/follow-ups?date_range=` and `POST /appointments/from-follow-up/{followUpId}`.
Data Model Changes
•	`follow_ups` (id, patient_id, visit_id, type, source ("manual"/"quick-date"), computed_date, appointment_id nullable, created_at).
Acceptance Criteria
•	Selecting a quick-date option correctly computes and displays the right calendar date relative to the visit date.
•	The doctor can still manually override the computed date.
•	The follow-up appears in both the Appointment module and the Receptionist section without duplicate manual entry.
3.4. Deworming – Quick-Date Dropdown & Auto-Calculation
Priority: Medium
Current State
Deworming due dates are entered manually with no quick-select shortcuts, mirroring the same friction described for Next Visit Date.
Required Change
•	Add a quick-date dropdown for the Deworming Date field with options: After 15 Days, After 30 Days, After 3 Months.
•	Selecting a quick-date option must automatically calculate and populate the corresponding future date.
Frontend / UI Implementation
•	Reuse the same quick-date dropdown component built for Next Visit Date, configured with Deworming-specific options.
•	Show the computed next-due date inline next to the Deworming section header/status badge.
Backend / API Implementation
•	Reuse the shared date-calculation utility (Section 4) with a Deworming-specific option set.
•	Store results in a `deworming_records` table analogous to `vaccinations`.
Data Model Changes
•	`deworming_records` (id, patient_id, visit_id, date_given, next_due_date, source, created_at).
Acceptance Criteria
•	Selecting After 15 Days / After 30 Days / After 3 Months correctly computes and fills the next Deworming date.
•	Deworming remains a section distinct from Vaccines, with its own due-date tracking.
3.5. Clone Treatment
Priority: Medium
Current State
There is no way to reuse a previous day's treatment; doctors must re-enter identical prescriptions from scratch even when the treatment plan hasn't changed.
Required Change
•	Add a "Clone Previous Treatment" action on the consultation screen that copies the most recent (e.g., prior day's) prescription — medicines, food/accessories, dosages — into the current visit for the doctor to review and adjust before saving.
Frontend / UI Implementation
•	Add a "Clone Last Treatment" button near the Prescription section header, visible when a prior visit exists for the patient.
•	On click, pre-populate the current prescription list with the cloned items in an editable state (clearly marked as "cloned – pending review") so nothing is saved until the doctor confirms.
Backend / API Implementation
•	Expose `POST /visits/{currentVisitId}/clone-prescription?fromVisitId=` (default: most recent prior visit) that copies `prescription_items` rows into the new visit as drafts.
•	Ensure cloned items retain a reference (`cloned_from_visit_id`) for audit/traceability.
Data Model Changes
•	Add `cloned_from_visit_id` (nullable FK) to `prescription_items` for traceability.
Acceptance Criteria
•	Doctor can clone the immediately prior visit's treatment with one action and the cloned items are editable before saving.
•	Cloned prescriptions are clearly distinguishable from newly entered ones until confirmed.
3.6. Allergies – Separate, Prominent Display
Priority: High
Current State
Previously recorded allergies currently show up inside the Presenting Complaint text, easy to miss and not visually distinguished from general notes. There is also no structured way to capture allergy information at patient registration.
Required Change
•	Remove allergy information from the Presenting Complaint section.
•	At patient registration (Receptionist section), add an "Any Allergy?" Yes/No field; if Yes, capture the allergy details in a structured field.
•	Display recorded allergies in a separate, prominent block — bold text, distinct alert color — positioned near the top of the clinical page, above the Pet Intake Vitals section.
Frontend / UI Implementation
•	Add an "Any Allergy?" toggle + conditional text/multi-select field to the patient registration form in the Receptionist module.
•	On the clinical/consultation page, render a fixed "⚠ Allergies" banner component above Pet Intake Vitals whenever allergy data exists, using bold text on a distinct alert background (e.g., red/amber) so it cannot be missed.
•	Remove/hide legacy allergy text that was previously embedded inside Presenting Complaint (data-migrate existing free-text allergy mentions where feasible, otherwise flag for manual review).
Backend / API Implementation
•	Add `has_allergy` (boolean) and `allergy_details` (text/structured) fields to the `patients` table or a dedicated `patient_allergies` table (preferred, to support multiple allergies).
•	Expose allergy data via the existing `GET /patients/{id}` response (or a dedicated `GET /patients/{id}/allergies`) so the clinical page can render the banner on load.
Data Model Changes
•	`patient_allergies` (id, patient_id, allergy_text, severity nullable, created_by, created_at).
Acceptance Criteria
•	Registration form captures allergy status and details for new/existing patients.
•	Allergy banner appears above Pet Intake Vitals in bold, alert-colored styling whenever allergy data exists, and is absent from Presenting Complaint.
3.7. Food & Accessories – Dedicated Section & Analytics Foundation
Priority: Medium
Current State
Food and accessory items are not currently captured as structured, separately-categorized data, so no consumption tracking, reminders, or offers can be built on top of them.
Required Change
•	Create a dedicated Food & Accessories section, separate from Prescribed Medicines and Vaccines, using the same search/dropdown UX as medicines.
•	Store food/accessory purchase data in a structured, queryable form to support future analytics: food-consumption pattern analysis, running-out reminders, targeted offers, and correlation with the pet's weight/health trends.
Frontend / UI Implementation
•	Add a Food & Accessories card/section on the consultation and/or billing screen with searchable entry, quantity, and pack-size fields.
•	(Future phase) Add an analytics dashboard widget showing estimated food run-out date per patient, derived from pack size and purchase frequency.
Backend / API Implementation
•	Expose `POST /patients/{id}/food-purchases` to log each food/accessory transaction with item, quantity, pack size, and purchase date.
•	Design the schema now (even if analytics UI ships later) so consumption-rate calculations and reminder jobs can be built without a data-model migration.
•	(Future phase) Add a scheduled job to estimate run-out dates and trigger reminder notifications/offers via the existing notification/CRM channel.
Data Model Changes
•	`food_master` / `accessory_master` (id, name, category, pack_size, unit).
•	`food_purchases` (id, patient_id, visit_id nullable, item_id, quantity, pack_size, purchase_date, estimated_runout_date nullable).
Acceptance Criteria
•	Food and accessory items can be searched, added, and saved independently of the Medicines list.
•	Each purchase is stored with enough structure (item, quantity, date) to later compute consumption patterns without re-engineering the schema.
3.8. Blood Test – Dedicated, Linked Section
Priority: Medium
Current State
Blood test orders/results are not currently isolated into their own section and are not consistently linked to the pet's broader medical record.
Required Change
•	Add a separate Blood Test section on the clinical page, positioned below the other clinical entries (Medicines, Vaccines, Deworming, Food).
•	Ensure blood-test records/reports are linked to the pet's Medical Records so they remain accessible as part of the pet's full clinical history.
Frontend / UI Implementation
•	Add a "Blood Test" card allowing test-type selection, order date, and (once available) result/report upload or entry.
•	Add a "View in Medical Records" link so blood test entries are discoverable from the patient's history timeline, not just the current visit.
Backend / API Implementation
•	Expose `POST /visits/{id}/blood-tests` to record an order, and `POST /blood-tests/{id}/report` to attach a result/report file.
•	Ensure blood test records are included in the `GET /patients/{id}/history` response used by the Medical Records and "Previous History" views (Section 3.1).
Data Model Changes
•	`blood_tests` (id, patient_id, visit_id, test_type, ordered_date, result_date nullable, report_file_url nullable, status).
Acceptance Criteria
•	Blood test entries appear in their own section, not mixed with medicines/vaccines.
•	Blood test records are retrievable from the patient's Medical Records / previous-history view.
4. Cross-Cutting Technical Considerations
4.1 Shared Search / Autocomplete Component
Medicines, Food, and Accessories all require the same type-ahead search pattern. Build one reusable frontend component and one backend search interface (parameterized by catalog: medicine / food / accessory) rather than three separate implementations, to keep behavior and performance consistent.
4.2 Shared Quick-Date Calculation Utility
Next Visit Date and Deworming both need "add N days/months to the anchor date and populate the field" logic, just with different option sets (Tomorrow / Day After Tomorrow / After 5 Days / After 7 Days / After 1 Month for Next Visit; After 15 Days / After 30 Days / After 3 Months for Deworming). Implement a single configurable date-offset utility consumed by both features so the calculation logic and edge cases (month-end rollovers, timezone handling) are solved once.
4.3 Cross-Module Linking (Follow-ups, Records, Reports)
Several requirements depend on data flowing between modules that may currently be siloed: Clinical → Appointment (follow-ups), Clinical → Receptionist (allergy capture at registration, follow-up visibility), and Clinical → Medical Records (previous history, blood-test reports). These should be implemented as shared read APIs (e.g., a single patient-history endpoint) rather than one-off point-to-point integrations, so future sections can plug into the same history/records view.
4.4 Backward Compatibility
Per the change request's own UI/UX notes, the new sections and fields should retain existing VetOS parameters and workflow wherever a change isn't explicitly required. Existing prescription, vaccination, and visit records should continue to display correctly after the new `item_type`/section separations are introduced — a data migration/backfill step is needed wherever data is being split into new tables (e.g., separating allergy text out of Presenting Complaint, splitting food items out of the medicine list).
5. Suggested Screen / Data Organization
Area	Required Change	Purpose
Prescribed Medicines	Searchable medicine dropdown + visible added-items list	Faster entry and verification
Vaccines	Separate vaccine-type dropdown + individual due dates	Accurate vaccine scheduling
Deworming	Separate date field + quick-date dropdown	Faster follow-up scheduling
Next Visit	Quick-date dropdown + automatic date calculation	Reduce manual date entry
Treatment	Clone previous treatment	Avoid repeated data entry
Allergies	Separate, prominent, alert-style display	Improve clinical visibility
Food	Dedicated food/material purchase section	Separate categorization & future analytics
Blood Test	Dedicated section linked to records/reports	Centralize diagnostic history
6. Suggested Phased Rollout
Grouped so that shared infrastructure (search, date utility) is built once and reused, and high-impact/high-frequency pain points (medicine visibility, allergy prominence, vaccine categories, next-visit quick dates) ship first.
Phase	Modules	Rationale
Phase 1 – Foundation	Shared search component; shared date-offset utility; prescription_items schema refactor	Unblocks multiple downstream features and avoids rework
Phase 2 – High Priority	Medicine search & visibility (3.1); Allergies separate display (3.6); Vaccine categories (3.2); Next Visit quick-dates (3.3)	Highest daily-use impact and clinical-safety value (allergies)
Phase 3 – Medium Priority	Deworming quick-dates (3.4); Clone Treatment (3.5); Blood Test section (3.8)	Meaningful time-savings, lower urgency
Phase 4 – Extended	Food & Accessories section + purchase logging (3.7)	New data capture; enables later analytics phase
Phase 5 – Analytics (future)	Food consumption analytics, run-out reminders, offers	Depends on sufficient purchase-history data from Phase 4
7. Testing & QA Checklist
•	Medicine/food/accessory search returns correct, ranked matches for partial input and handles catalogs with 1,000+ entries without noticeable lag.
•	Added medicines/food/accessories persist visibly in the prescription list after page refresh (not just as a transient toast).
•	Each of the three vaccine types (All-in-1, Anti-rabies, Kennel Cough) can be recorded and tracked independently for the same patient.
•	Quick-date options for Next Visit and Deworming compute the correct calendar date, including month-end and leap-year edge cases.
•	Manually overriding an auto-computed date is possible and persists correctly.
•	Follow-up entries created on the Clinical screen are visible in both the Appointment module and the Receptionist section.
•	Clone Treatment correctly copies the previous visit's items into an editable draft without auto-saving, and traceability (cloned_from_visit_id) is recorded.
•	Allergy data entered at registration displays as a bold, alert-colored banner above Pet Intake Vitals on every subsequent visit, and does not appear inside Presenting Complaint.
•	Food/accessory purchases are saved with item, quantity, and date sufficient to later compute consumption analytics.
•	Blood test records are visible both in their dedicated section and via the patient's Medical Records / previous-history view.
•	Existing (pre-change) prescriptions, vaccination records, and visit histories continue to render correctly after schema changes and any data migration.
