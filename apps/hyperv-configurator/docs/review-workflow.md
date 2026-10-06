# Review and resolve a design

Version: 0.10.0

Open **Review and exports** to see required inputs by section. The count includes visible required fields on existing records and the project/management identity fields. It does not assume that an empty inventory is complete. Missing required resources, cross-field rules and support questions appear in the separate unresolved/review columns.

Select a validation message to open its owning screen and record. Required-field, reference, address, range and mapped storage/stage findings focus the relevant input. Findings about several decisions open the record for review. A storage finding about a workload opens the workload in Project; one about a management component opens its hosting record.

Keyboard users can Tab to a finding and press Enter. The record opens and the input receives focus. Ordinary navigation moves focus to the section heading. Inputs and textareas retain their visible label names when their contents change.

Correct the input and return to Review. Findings and required-input counts recalculate immediately. Removing an error does not verify support, execution authorization, completed deployment or successful failover. Download the project to retain every answer; reports include the remaining findings.

## Implementation and verification

`src/review.ts` owns record/field routing and required-input counts. Generic findings in `validation.ts` carry an optional `fieldKey`; storage/stage codes have explicit mappings. `App.tsx` opens records using exact data attributes, avoiding CSS interpolation of imported resource IDs, and focuses inputs after React renders the destination.

`src/review.test.ts` checks cross-section routing, missing-record fallback and conditional required counts. `e2e/review.spec.ts` verifies project-owner focus, keyboard activation of a collapsed volume's missing-owner finding, recalculation, computed-volume-size focus and mobile layout. Existing save/open/export journeys remain regression gates.
