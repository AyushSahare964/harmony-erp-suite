Objective

Update the existing Patient Profile section of the veterinary ERP
system.

The current patient profile is too compact and mainly works as a quick
patient summary. Transform it into a detailed, professional Veterinary
Patient 360° Profile that provides complete information about:

Patient / Pet

Pet Parent / Owner

Contact and address details

Patient photo

Medical and clinical information

Previous appointments

Upcoming appointments

Previous consultation reports

Prescription and treatment history

Vaccination and deworming history

Patient documents and photos

Current billing summary

Previous bills / complete billing history

IMPORTANT

This is an existing working veterinary ERP.

Do NOT rebuild the entire application.

Do NOT change or break the existing workflow:

Reception → Patient Profile → Prescription → Medical Records → Reports → History → Appointments

Do not remove any currently working functionality. Only redesign and
extend the Patient Profile section.

Before making changes, inspect the existing Patient Profile component,
database models/schema, APIs, routes, appointment logic, prescription
logic, reports, and billing logic. Reuse existing functionality wherever
possible.

1. Patient Profile Header

Replace the current compact patient popup/profile design with a detailed
Patient Header Card.

Display:

Patient / Pet Photo

Patient Name

Patient ID

Species

Breed

Gender / Sex

Age

Date of Birth

Current Status: Active / Inactive

Sterilization Status

Microchip Number

Blood Group

Coat / Color

Current Weight

Example:

[Pet Photo]

Bruno
Patient ID: PET-0001

Canine · German Shepherd · Male
Age: 4 Years
DOB: 12/04/2022
Weight: 18.5 kg

● Active

Provide quick actions:

Edit Patient

Upload Photo

Book Appointment

Start OPD Consultation & Rx

View Medical Records

View Reports

The existing Start OPD Consultation & Rx button must continue to
work exactly as it currently does.

2. Patient Photo Management

The patient profile must support uploading and managing the pet's photo.

Provide:

Upload Photo from device

Upload from Gallery

Upload from Files

Camera option if supported by the browser/device

Change existing photo

Remove photo

Preview uploaded photo

Set uploaded photo as Profile Photo

If no photo exists, show a professional default pet avatar.

The main profile photo should not be replaced automatically when
uploading additional medical/clinical photos. The user must explicitly
choose Set as Profile Photo.

3. Patient Information

Create a dedicated section:

Patient Information

Include:

Patient Name

Patient ID

Species

Breed

Gender

Date of Birth

Age

Weight

Coat / Color

Sterilization Status

Microchip Number

Blood Group

Identification / Tag Number

Status

Use a clean two-column or three-column responsive layout.

Required fields must be clearly marked.

Allow the information to be edited through an Edit Patient action.

4. Pet Parent / Owner Information

Create a separate section:

Pet Parent / Owner Information

This section should contain detailed owner information similar to the
provided reference design.

Fields:

Full Name *

Owner ID / Client ID

Phone Number *

Alternate Phone Number

Email ID

Billing Address *

City

State *

PIN Code

Country

Occupation, if available

Relationship with Pet

Example:

Pet Parent
Ayush Sahare
Owner ID: OWN-0001

Phone:
+91 78945 61230

Alternate Phone:
[if available]

Email:
example@email.com

Billing Address:
[Complete address]

City:
Nagpur

State:
Maharashtra

PIN Code:
440001

Country:
India

Relationship:
Owner

Make the address support multiline text.

City, State, PIN Code and complete address must be clearly visible.

The owner information must remain connected to the patient.

If one owner has multiple pets, show:

Other Pets by This Owner

Display a small list of other patients/pets belonging to the same Owner
ID.

Do not create duplicate owner or patient records.

5. Contact Information

Create a compact section:

Contact Information

Display:

Primary Phone

Alternate Phone

Email

Complete Address

City

State

PIN Code

Country

Provide convenient actions:

Call

WhatsApp

Email

If WhatsApp integration already exists in the system, reuse the existing
WhatsApp functionality.

Do not create a separate WhatsApp system if one already exists.

6. Drug Allergies & Clinical Alerts

Keep the existing allergy and clinical alert functionality.

Create a highly visible section:

Drug Allergies & Clinical Alerts

Display:

Drug Allergies

Food Allergies

Other Allergies

Important Clinical Alerts

Existing medical warnings

Example:

⚠ Drug Allergies

NSAIDs (Meloxicam)

If there are no allergies, display:

No known allergies

Use red/warning styling only for clinically important alerts.

The allergy information must remain visible when starting a consultation
or prescription.

7. Current Clinical Summary

Create:

Current Clinical Summary

Include available clinical information such as:

Current Weight

Temperature

Heart Rate

Respiratory Rate

SpO2, if available

Current Medications

Active Medical Conditions

Recent Diagnosis

Last Consultation Date

Last Vaccination Date

Next Vaccination Date

Last Deworming Date

Next Deworming Date

Only display parameters that actually exist in the database.

Do not create fake values.

If information is unavailable, display:

N/A

8. Medical History

Create:

Medical History

Display historical medical information in a professional timeline or
table.

Each record should contain:

Date

Visit ID

Doctor / Veterinarian

Chief Complaint

Diagnosis

Clinical Findings

Treatment

Prescription

Follow-up

Notes

Example:

12 Sep 2026
Dr. XYZ

Complaint:
Fever and vomiting

Diagnosis:
Gastroenteritis

Treatment:
Medication prescribed

Follow-up:
7 days

Allow the user to click a record to open the complete consultation.

Use existing medical records.

Do not create duplicate medical records.

9. Previous Appointment History

Create:

Previous Appointments

Display previous appointments in a professional table or card layout.

Columns:

Date

Time

Doctor

Appointment Type

Reason / Complaint

Status

Consultation ID

Actions

Possible statuses:

Completed

Cancelled

No Show

For completed appointments provide:

View Consultation

Clicking it must open the corresponding consultation / medical record.

10. Upcoming Appointments

Create:

Upcoming Appointments

Display all upcoming appointments associated with the patient.

Include:

Appointment Date

Time

Doctor

Appointment Type

Reason

Status

Follow-up Notes

Example:

28 Sep 2026
10:30 AM
Dr. Manisha Mhetre

Follow-up Consultation

Status: Confirmed

Actions:

View

Reschedule

Cancel

Only display appointments that actually exist in the database.

If no upcoming appointments exist, show:

No upcoming appointments

Provide:

+ Schedule Appointment

This must use the existing appointment workflow and automatically
pre-select the current patient.

11. Previous Consultation Reports

Create:

Consultation Reports

Show all previous consultation reports associated with the patient.

Each report should contain:

Consultation Date

Doctor

Consultation ID

Chief Complaint

Diagnosis

Clinical Findings

Clinical Treatment

Medicines

Injectable Medicines

Follow-up

Notes

Fees

Payment Status

Actions:

View Report

Download PDF

Print

If PDF generation already exists in the application, reuse it.

Do not create a duplicate report-generation system.

12. Prescription & Medication History

Create:

Prescription & Medication History

Display previous prescriptions.

Columns:

Date

Medicine

Dosage

Frequency

Duration

Route

Prescribed By

Status

Provide:

View Prescription

Use the existing prescription data and APIs.

Do not create duplicate prescription records.

13. Vaccination & Deworming

Create:

Preventive Care

Divide this into:

Vaccination History

Include:

Vaccine Name

Date Given

Next Due Date

Batch Number, if available

Doctor

Notes

Deworming History

Include:

Date

Medicine

Dosage

Next Due Date

Doctor

Notes

Clearly highlight upcoming due dates.

14. Patient Documents

Create:

Patient Documents

Allow staff to upload and view documents related specifically to the
patient.

Supported files where technically supported:

PDF

JPG

JPEG

PNG

DOC / DOCX

Examples:

Previous medical reports

Lab reports

X-rays

Ultrasound reports

Vaccination certificates

Insurance documents

Other medical documents

Actions:

Upload Document

View

Download

Delete

Every uploaded document must be associated with the correct Patient ID.

Do not store patient documents globally without patient association.

15. Patient Photos / Medical Photo Gallery

Create:

Patient Photos

Allow multiple photos of the patient.

Possible uses:

General patient photo

Skin condition

Wound

Pre-treatment condition

Post-treatment condition

Swelling

Injury

Other clinical observations

Provide:

Upload Photo

Support:

Gallery

Files

Camera, if available

Display photos in a clean gallery.

Each photo can optionally contain:

Date

Description

Uploaded By

Allow the user to choose:

Set as Profile Photo

Do not automatically replace the main profile photo.

16. Billing Summary

Create:

Billing Summary

This is the patient's overall current financial summary.

Display:

Total Consultation Fees

Total Bill Amount

Total Discount

Total Paid Amount

Total Pending Amount

Last Payment Date

Current Payment Status

Payment statuses:

Paid

Partially Paid

Pending

Use the existing billing and settlement data.

Do not change existing billing calculations.

Provide:

View Billing History

17. Previous Bills / Billing History

Create a dedicated section:

Previous Bills & Billing History

This section must show all previous bills/invoices generated for the
patient.

Do not combine this only with the current Billing Summary. The summary
shows the current financial overview, while this section shows the
complete historical billing records.

Display bills in a clean table or expandable card layout.

Each bill should contain:

Bill / Invoice Number

Bill Date

Patient ID

Patient Name

Owner Name

Consultation / Visit ID

Doctor / Veterinarian

Billing Type

Total Amount

Discount

Net Amount

Paid Amount

Pending Amount

Payment Method

Payment Status

Created By

Possible payment statuses:

Paid

Partially Paid

Pending

Cancelled, if supported by the existing system

Example:

Invoice No: INV-2026-00125
Date: 12/09/2026

Patient:
Bruno · PET-0001

Owner:
Ayush Sahare

Consultation:
CONS-00045

Doctor:
Dr. XYZ

Total Amount: ₹2,500
Discount: ₹200
Net Amount: ₹2,300
Paid: ₹1,500
Pending: ₹800

Payment Method:
UPI

Status:
Partially Paid

Actions for each bill:

View Bill

View Details

Download PDF

Print

View Payment Details

If the existing application has bill/invoice PDF generation, reuse it.

Do not create a second billing calculation system.

The bill must open using its actual stored billing record.

18. Payment History

Within or alongside Previous Bills, provide:

Payment History

Display individual payments made against the patient/bills.

Include:

Payment Date

Bill Number

Amount Paid

Payment Method

Transaction / Reference Number, if available

Received By

Payment Status

Support existing payment methods such as:

Cash

UPI

Card

Bank Transfer

Other methods already supported by the ERP

Do not invent payment methods that are not supported by the current
application.

For partially paid bills, clearly show:

Total: ₹2,300
Paid: ₹1,500
Pending: ₹800

This must use the existing billing/settlement records.

19. Quick Actions

At the top of the Patient Profile provide:

Start OPD Consultation & Rx

Book Appointment

Edit Patient

Edit Owner

Upload Photo

Upload Document

View Medical Records

View Reports

View Previous Bills

The existing:

Start OPD Consultation & Rx

button must continue to work exactly as before.

20. Recommended Patient Profile Layout

Use the following overall structure:

PATIENT PROFILE
==================================================

PATIENT HEADER
--------------------------------------------------
[Pet Photo]

Bruno
PET-0001

Canine · German Shepherd · Male
Age · DOB · Weight
● Active

[Edit Patient] [Upload Photo]


DRUG ALLERGIES & CLINICAL ALERTS
--------------------------------------------------
⚠ NSAIDs (Meloxicam)


PATIENT INFORMATION
--------------------------------------------------
Patient ID | Name | Species | Breed
Gender | DOB | Age | Weight
Color | Sterilization | Microchip | Blood Group


PET PARENT / OWNER INFORMATION
--------------------------------------------------
Full Name
Owner ID
Phone
Alternate Phone
Email
Complete Address
City
State
PIN Code
Country
Relationship


CONTACT INFORMATION
--------------------------------------------------
Phone | WhatsApp | Email
Address


CURRENT CLINICAL SUMMARY
--------------------------------------------------
Weight
Temperature
Heart Rate
Respiratory Rate
Current Medication
Current Conditions
Last Visit
Next Follow-up


UPCOMING APPOINTMENTS
--------------------------------------------------
Upcoming appointment cards/table


PREVIOUS APPOINTMENTS
--------------------------------------------------
Appointment history


MEDICAL HISTORY
--------------------------------------------------
Medical timeline / history


CONSULTATION REPORTS
--------------------------------------------------
Previous consultation reports
[View] [Download] [Print]


PRESCRIPTION HISTORY
--------------------------------------------------
Previous prescriptions


VACCINATION & DEWORMING
--------------------------------------------------
Vaccination history
Deworming history


PATIENT DOCUMENTS
--------------------------------------------------
Uploaded documents


PATIENT PHOTOS
--------------------------------------------------
Medical/general photo gallery


BILLING SUMMARY
--------------------------------------------------
Total | Discount | Paid | Pending


PREVIOUS BILLS & BILLING HISTORY
--------------------------------------------------
Invoice history
Bill details
Payment status
[View] [PDF] [Print]


PAYMENT HISTORY
--------------------------------------------------
Payment records


QUICK ACTIONS
--------------------------------------------------
[Start OPD Consultation & Rx]
[Book Appointment]
[Edit Patient]
[View Medical Records]
[View Reports]
[View Previous Bills]

21. Recommended Tab-Based Navigation

Do not make the entire profile an unnecessarily long single page.

Use a Patient 360° navigation structure:

Overview
Appointments
Medical History
Consultations & Reports
Prescriptions
Preventive Care
Documents & Photos
Billing

Overview

Show:

Patient Header

Patient Information

Owner Information

Contact Information

Allergies & Clinical Alerts

Current Clinical Summary

Upcoming Appointment

Important quick actions

Appointments

Show:

Previous Appointments

Upcoming Appointments

Appointment actions

Medical History

Show:

Medical History

Previous diagnoses

Clinical findings

Treatment history

Consultations & Reports

Show:

Previous consultations

Consultation reports

View / Print / Download

Prescriptions

Show:

Prescription History

Medication history

Preventive Care

Show:

Vaccination

Deworming

Upcoming preventive care

Documents & Photos

Show:

Patient documents

Medical documents

Patient photo gallery

Billing

Show:

Billing Summary

Previous Bills

Payment History

Outstanding amount

This structure should make the Patient Profile feel like a professional
veterinary EMR / hospital management system.

22. Edit Patient Mode

Provide:

Edit Patient

Allow editing of:

Patient

Name

Species

Breed

Gender

Date of Birth

Weight

Color

Sterilization

Microchip

Blood Group

Identification / Tag Number

Owner

Full Name

Phone

Alternate Phone

Email

Billing Address

City

State

PIN Code

Country

Relationship

Clinical

Allergies

Clinical Alerts

Other relevant editable clinical fields already supported by the
application

Use proper validation.

Required fields must not be saved empty.

23. Database and Data Integration

The Patient Profile must use real existing data.

Do NOT use hardcoded dummy information.

The Patient Profile must retrieve information using the existing Patient
ID.

Connect the profile with:

Patient

Owner / Pet Parent

Appointments

Consultations

Prescriptions

Medical Records

Reports

Billing

Previous Bills

Payments

Vaccinations

Deworming

Documents

Photos

Use the existing database schema wherever possible.

If some required fields do not currently exist, extend the existing
schema carefully without breaking existing records.

Use:

Patient ID for patient-related records

Owner ID for owner-related records

Consultation / Visit ID for consultation-related records

Bill / Invoice ID for billing records

Every appointment, consultation, prescription, report, billing record,
payment, document and photo must remain associated with the correct
Patient ID.

24. Data Safety and Existing Functionality

This is an existing working veterinary ERP.

DO NOT:

Delete existing database records

Change existing Patient IDs

Break appointment functionality

Break prescription functionality

Break billing

Break reports

Remove allergy warnings

Remove the existing OPD workflow

Replace backend APIs unnecessarily

Create duplicate patients

Create duplicate appointments

Create duplicate bills

Create duplicate payments

Hardcode sample data

Before modifying backend/database logic, inspect the existing
implementation and reuse existing APIs/models.

Preserve all current data.

25. Responsive Design

The Patient Profile must work properly on:

Desktop

Laptop

Tablet

On smaller screens:

Convert multi-column layouts into stacked sections

Make tables horizontally scrollable where necessary

Convert complex tables into responsive cards where appropriate

Keep buttons accessible

Keep important alerts visible

The page should remain clean and usable.

26. UI / UX Design

The design should be professional and suitable for a real veterinary
hospital.

Use:

White / light background

Blue as the primary accent

Red only for allergies and critical alerts

Rounded cards

Clean typography

Clear section headings

Proper spacing

Subtle borders

Minimal shadows

Consistent icons

Responsive layout

Avoid making every small item into a huge card.

Use clear visual hierarchy.

Important information should be immediately visible.

The profile should feel like a professional veterinary hospital / EMR
system rather than a basic CRUD form.

27. Patient 360° Workflow

When opening a patient from Reception:

Reception
    ↓
Patient Profile
    ↓
Load Patient ID
    ↓
Load Patient Information
    ↓
Load Owner Information
    ↓
Load Allergies / Clinical Alerts
    ↓
Load Clinical Summary
    ↓
Load Previous Appointments
    ↓
Load Upcoming Appointments
    ↓
Load Medical History
    ↓
Load Consultation Reports
    ↓
Load Prescription History
    ↓
Load Vaccination / Deworming
    ↓
Load Documents / Photos
    ↓
Load Billing Summary
    ↓
Load Previous Bills
    ↓
Load Payment History

No manual re-entry should be required.

28. Existing Workflow Integration

When the user clicks:

Start OPD Consultation & Rx

Open the existing consultation/prescription workflow with:

Patient information

Patient ID

Owner information

Allergies

Current weight

Relevant clinical information

already populated.

Do not make the receptionist or doctor enter information that already
exists.

When the user clicks:

View Consultation

Open the corresponding historical consultation.

When the user clicks:

View Report

Open the corresponding consultation report.

When the user clicks:

Book Appointment

Open the existing appointment workflow with the current patient
automatically selected.

When the user clicks:

View Previous Bill

Open the actual stored bill/invoice record.

When the user clicks:

Download PDF

Use the existing PDF generation functionality if available.

29. Loading and Empty States

Every section that retrieves data asynchronously should have a proper
loading state.

Examples:

Loading appointments...
Loading medical history...
Loading consultation reports...
Loading billing history...

For empty data:

No previous appointments
No upcoming appointments
No consultation reports
No prescription history
No vaccination records
No documents uploaded
No additional photos
No previous bills
No payment history

Do not show broken UI or empty blank spaces.

30. Error Handling

If one section fails to load, the complete Patient Profile should not
crash.

For example:

If billing history fails to load:

Unable to load billing history.
Try again.

Other patient information should continue to work.

Use proper error boundaries and API error handling where appropriate.

31. Performance

Do not load extremely large histories unnecessarily.

For sections such as:

Previous appointments

Medical history

Consultation reports

Prescription history

Previous bills

Payment history

use pagination, lazy loading, or expandable sections where appropriate.

The initial Patient Profile should load quickly.

32. Final Acceptance Criteria

The implementation will be considered complete only when a
veterinarian/receptionist can open one patient and understand:

Patient

Who the patient is

Patient ID

Species

Breed

Gender

Age

DOB

Weight

Color

Sterilization

Microchip

Blood Group

Patient photo

Owner

Who owns the patient

Owner ID

Full name

Phone

Alternate phone

Email

Complete address

City

State

PIN Code

Country

Relationship with pet

Clinical

Allergies

Clinical alerts

Current health summary

Current medications

Medical conditions

Medical history

Appointments

Previous appointments

Upcoming appointments

Doctor

Appointment status

Consultation ID

Consultations

Previous consultations

Consultation reports

Diagnosis

Clinical findings

Treatment

Follow-up

Notes

Prescriptions

Previous prescriptions

Medicines

Dosage

Frequency

Duration

Route

Preventive Care

Vaccination history

Upcoming vaccination

Deworming history

Upcoming deworming

Documents and Photos

Medical documents

Uploaded reports

X-rays / images

Patient photos

Profile photo

Billing

Total bills

Total amount

Discounts

Paid amount

Pending amount

Payment status

Previous bills

Invoice numbers

Payment history

Payment methods

Bill PDF / Print

The entire patient history should be accessible from one Patient 360°
profile without forcing the user to search through unrelated screens.

33. Final Testing

After implementation, test the complete flow:

Reception
    ↓
Open Existing Patient
    ↓
Patient Profile
    ↓
Edit Patient
    ↓
Edit Owner
    ↓
Upload Pet Photo
    ↓
Upload Medical Document
    ↓
View Previous Appointment
    ↓
View Previous Consultation
    ↓
View Consultation Report
    ↓
View Prescription History
    ↓
View Previous Bills
    ↓
View Payment History
    ↓
Book Upcoming Appointment
    ↓
Start OPD Consultation & Rx
    ↓
Save Consultation
    ↓
Generate / View Bill
    ↓
Return to Patient Profile
    ↓
Verify New Consultation and Billing Records

Verify that the newly created consultation, prescription, appointment
and billing records appear correctly in the Patient Profile.

Most importantly, verify that all existing functionality continues to
work after the Patient Profile redesign.

Final Instruction to Antigravity

First inspect the existing application architecture and identify:

Current Patient Profile component

Patient database model/schema

Owner/Pet Parent model/schema

Appointment model/API

Consultation model/API

Prescription model/API

Medical Records model/API

Reports model/API

Billing/Invoice model/API

Payment/Settlement model/API

Document/file upload implementation

Patient photo implementation

Then implement the Patient 360° Profile using the existing architecture.

Do not blindly create new models or duplicate APIs when equivalent
functionality already exists.

Do not break existing data or workflows.

Preserve backward compatibility with existing patients, appointments,
prescriptions, reports, bills and payments.

The final result should look and behave like a polished professional
veterinary hospital Patient 360° / EMR profile.