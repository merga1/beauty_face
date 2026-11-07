# Beauty Face product plan

## Product goal

Beauty Face helps people in Ethiopia make more informed cosmetics purchases and reach qualified dermatology care. The MVP begins as a curated mobile web storefront for Addis Ababa and Adama, with a Chapa hosted checkout path. It will not claim to diagnose skin conditions or verify a product until evidence and qualified review support that claim.

## Decisions and open questions

- **Payments:** Chapa is the first provider. Start with test credentials and hosted checkout; keep the private key on the Express server. The implementation uses Chapa API v2 and ETB integer cents.
- **Clinical partners:** none are identified yet. The current callback form creates a pilot waitlist entry, not an appointment. Do not advertise clinician availability until licensing and staffing are confirmed.
- **Launch cities:** Addis Ababa plus one additional city. The scaffold uses Adama as the configurable second city assumption; confirm courier coverage and fees before accepting real orders there.
- **Still to decide:** who owns product sourcing and expiry checks; customer support hours; delivery fees and service areas by city; Chapa merchant onboarding and payment method availability; target age policy; medical record retention period; staffing and escalation coverage.

## Users and roles

- **Customer:** browse ingredients and use instructions, compare products, save a short-lived cart, request a callback, and track an order.
- **Doctor / dermatologist:** verify a practitioner license, set available times, review a case with consent, document advice, and follow up. This requires a clinical partner and secure authenticated workspace.
- **Seller / supplier / pharmacy:** submit identity and sourcing documents, product labels, lot and expiry data, stock, and pricing. Listings stay unpublished until reviewed.
- **Delivery rider:** receive only the order information needed for delivery, update status, and contact the customer through an approved channel.
- **Admin:** verify providers and suppliers, review labels and claims, manage listings, customer records, order fulfillment, rider assignments, safety reports, articles, delivery settings, and administrator access; audit changes.

## Prioritized requirements

### MVP now

1. Mobile-first catalog with product name, category, price in ETB, ingredient and use fields, warnings, stock, and supplier-verification state.
2. Search and category, concern, and skin-type filters. Avoid implying that matching is medical advice.
3. Browser-session cart, a delivery form for city, sub-city, woreda, and landmark, and server-created order totals.
4. Chapa hosted checkout using a server-only key, unique merchant reference, idempotency key, server-side verification, signed webhook authentication, and payment-to-order amount matching.
5. Encrypted contact and delivery fields before storage. Consent-gated pilot callback requests that contain no symptom narrative or photos.
6. Protected admin workspace for products, sellers, clinicians, customer records, orders, callback requests, safety reports, riders, articles, site/delivery settings, and administrator accounts. Payment status is read-only and based on Chapa verification; all active admins currently have full access.
7. Admin workflow is manual for the pilot: do not publish a real seller's product until provenance, label, expiry, and relevant regulatory status have been checked.
8. Clear demo listing tags and medical disclaimers; no diagnosis, prescriptions, or live consultation promise.
9. A product-safety form for quality, suspected counterfeit, reaction, labeling, or other concerns; reports and optional contact details are encrypted and reviewed in the admin workspace.

### Next: operational pilot

- Phone OTP and account recovery; customer order history; role-based seller, clinical, delivery, and admin workspaces.
- Seller verification, product submission and approval, batch/expiry tracking, order fulfillment, complaints, refunds, and customer support.
- Delivery zones and fee configuration for Addis Ababa and Adama; rider assignments and status messages.
- Chapa reconciliation, verified test-to-live migration, refund workflow, and failure monitoring.
- English and Amharic content review; Afaan Oromoo after translation and user testing.
- Appointment scheduling only after licensed clinicians, availability, consent, and escalation operations are in place.

### Later

- Secure asynchronous chat and video consults; follow-up reminders; clinician notes and recommendations.
- Barcode/product safety lookup based on EFDA and supplier evidence, with source date and uncertainty shown.
- Camera-assisted skin screening as a separate, opt-in research and clinical safety program.
- Flutter client after the web workflow and shared API are proven.
- Premium membership only after conflict-of-interest rules and clinical governance are defined.

## User flows

### Customer

1. Open the storefront, browse or filter the catalog, and open a product detail.
2. Review ingredients, directions, warnings, supplier state, and sample/verified status.
3. Add an item to the cart; provide delivery city and local address details.
4. The API recalculates prices and stock, creates an order, and redirects to Chapa hosted checkout.
5. On return, the API verifies amount, currency, and merchant reference with Chapa. The interface displays pending, paid, or failed state; a browser redirect alone never marks an order paid.
6. For medical questions, submit a minimal callback request only if the pilot is open. No photo or symptom detail is collected in this build.

### Doctor / dermatologist

1. Submit license and identity evidence to an administrator.
2. An administrator verifies credentials and records an audit event.
3. A verified provider sets availability and accepts a request.
4. The patient reviews purpose, privacy, and data sharing; explicitly consents before records or photos are shared.
5. The provider documents advice in an access-controlled clinical record and schedules follow-up. This workflow is future work.

### Seller / supplier

1. Register and provide business and sourcing documents.
2. Submit product label images, full ingredient list, claims, batch, expiry, and stock.
3. An administrator checks the seller, product classification, documents, and claims.
4. Only approved products are published; rejected, recalled, expired, or disputed lots are blocked. This workflow is future work.

### Delivery rider

1. An administrator assigns a paid, prepared order to an onboarded rider.
2. The rider sees the minimum delivery contact and location data needed for the route.
3. The rider records pickup, delivery attempt, and completion; the customer gets a status update. This workflow is future work.

### Administrator

1. Review seller and clinician evidence, approvals, expiry, stock, complaints, and payment reconciliation.
2. Keep an audit record for changes to identity verification, safety status, product content, order status, and access to health information.
3. Escalate adverse events and suspected unsafe or counterfeit products; suspend affected listings and preserve evidence.

## Key screens

- **Home / catalog:** editorial hero, product search, category shortcuts, safety/verification callout, sample listings, education links, and local-language selector.
- **Product detail:** current price, supplier verification state, label-backed ingredients, use directions, expiry/lot evidence, warnings, suitability notes, and add-to-cart action.
- **Cart / checkout:** item quantity, server-priced subtotal, delivery fee, city and landmark address, phone, consent/notice, and secure redirect to Chapa.
- **Payment return:** verification progress and paid/pending/failed state derived from the API.
- **Callback pilot:** explains availability limitations, collects name, phone, city, preferred contact mode, and privacy consent; no free-text medical concern or photo.
- **Future clinician workspace:** license status, schedule, assigned case, patient-consented files, structured note, recommendations, follow-up, and audit history.
- **Admin workspace:** verification queues, catalog and content publishing, customer record actions, order fulfillment and rider assignment, safety reports, delivery configuration, access control, and audit history. Lot expiry tracking and refund workflows need additional backend support.

## Three-phase roadmap

| Phase | Indicative duration | Deliverable | Exit evidence |
|---|---:|---|---|
| 1. Foundation and closed pilot | 0–8 weeks | Catalog, product review process, responsive site, encrypted data path, Chapa test checkout, delivery in Addis Ababa and Adama only where a courier is contracted | Product evidence reviewed; payment reconciliation and cancellation paths rehearsed; delivery coverage and support staffed |
| 2. Operational commerce and clinical onboarding | 8–16 weeks | Seller/admin workflows, OTP accounts, fulfillment, support, language work, verified clinicians and appointment pilot | Provider credentials checked; privacy and clinical procedures signed off; incident and refund drills complete |
| 3. Scale and evaluate screening | 4–9 months | More cities, richer education, secure consult tools, opt-in screening research, and Flutter decision | Fairness and safety review passed; external clinical oversight and legal review; ongoing monitoring funded |

Timelines are planning estimates and depend on regulatory review, partner availability, payment approval, and delivery operations.

## AI skin-screening plan

The first release does not analyze photos. The eventual feature must be framed as a **screening aid, never a diagnosis**. Do not recommend treatment or delay care based on model output.

1. **Define a narrow intended use:** start with image-quality guidance and broad visible concern triage for adults, with explicit non-diagnostic labels. Exclude emergencies, children, mucosal areas, and high-risk lesions unless a clinician and regulator approve a separate pathway.
2. **Data:** prefer consented, de-identified images with dermatologist labels and documented rights. Build a locally governed Ethiopia dataset across regions, ages, devices, lighting, and Fitzpatrick IV–VI skin tones. Public datasets may help pretraining only after license, label quality, demographic coverage, and clinical fit are reviewed; they cannot substitute for local validation.
3. **Model:** compare a calibrated image classifier with a simpler quality/triage baseline. Keep image inference as a separable service; avoid automatic diagnosis and avoid exporting photos to general-purpose model APIs.
4. **Consent and retention:** capture separate consent for analysis, storage, clinician sharing, and research. Do not make photo upload required to shop. Define deletion periods, access logging, incident response, and cross-border transfer review before collecting photos.
5. **Evaluation:** hold out patients and sites, not just random images. Report sensitivity, specificity, calibration, abstention, image quality failure, and referral rates overall and by skin tone, age, sex, geography, and device. Test lighting, camera, compression, and real-world prevalence. Set clinician-approved minimums before release.
6. **Safety:** abstain when uncertain or out of scope; route urgent or concerning descriptions to a clinician/emergency guidance reviewed by local clinicians. Show limitations and an easy route to human care. Monitor drift, complaints, adverse events, and subgroup gaps; pause the model when thresholds fail.
7. **Governance:** establish an Ethiopian clinical advisory group, ethics review, dataset-use agreements, product/regulatory classification review, and independent clinical safety review before deployment.

## Risks and mitigation

| Risk | Mitigation |
|---|---|
| Counterfeit, expired, or misrepresented products | Require seller/source evidence, label and lot review, expiry tracking, complaint intake, recalls, and visible verification state; hide unreviewed listings from live commerce. |
| Medical harm from automated guidance | Do not ship diagnostic output in the MVP; use clinician review, conservative abstention, subgroup evaluation, escalation, and ongoing monitoring before any screening launch. |
| Sensitive photo or health-data exposure | Do not collect photos in phase 1; minimize data, encrypt it, restrict access, log access, define deletion, and complete a privacy impact assessment. |
| Regulatory or telemedicine non-compliance | Obtain Ethiopian legal and clinical advice on product classification, provider licensing, telemedicine, advertising, prescriptions, and data obligations before launch. |
| Payment disputes or false success | Keep secrets server-side; use hosted checkout, idempotency, signed webhooks, server verification, immutable order snapshots, and reconciliation. |
| Delivery coverage and address ambiguity | Pilot only contracted zones; collect sub-city, woreda, and landmark; publish fees and service times; allow support to resolve delivery issues. |
| Low bandwidth and language mismatch | Optimize assets, keep pages light, make forms resilient, translate with local reviewers, and test on low-cost Android devices and variable networks. |
| Conflicts between care and product promotion | Separate clinician advice from sponsored placements; disclose commercial relationships; prohibit pay-to-recommend clinical products. |

## Addis Ababa then expansion

- Begin with a small, manually reviewed catalog and a limited set of delivery zones in Addis Ababa.
- Configure Adama as the proposed second-city pilot only after courier, customer-support, and return/refund processes are contracted and tested.
- Measure successful delivery, repeat purchase, product complaints, payment failure, support resolution, and language preference before opening further cities.
- Add cities only when verified supply, service hours, delivery partners, and clinician referral coverage can support them.

## Regulatory and source notes

This product plan is not legal advice. Ethiopia's Ministry of Justice lists Personal Data Protection Proclamation No. 1321/2024 as in force. EFDA regulates cosmetics and publishes cosmetic directives and product-registration guidance; the applicable path depends on product type and claims and needs local legal/regulatory review. Provider licensing should be checked with the Ministry of Health's licensing systems and relevant authorities. Review the source texts and current directives before a commercial launch.

- [Ethiopian Ministry of Justice: Personal Data Protection Proclamation No. 1321/2024](https://justice.gov.et/en/law/personal-data-protection-proclamation/)
- [EFDA: Cosmetic directives](https://www.efda.gov.et/doc-category/cosmetic-directive/)
- [EFDA: cosmetics registration guideline](https://www.efda.gov.et/wp-content/uploads/2019/03/cosmetics_2.pdf)
- [Ethiopian Ministry of Health: eHPL licensing portal](https://hrl.moh.gov.et/)
- [Chapa API v2 quick start](https://docs.chapa.global/docs/v2/getting-started)
- [Chapa payment verification guidance](https://docs.chapa.global/docs/v2/integrations/verify-payment)
- [Chapa webhook authentication guidance](https://docs.chapa.global/docs/v2/integrations/webhooks)
