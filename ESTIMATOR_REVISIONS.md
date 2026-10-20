# Estimator Revisions

Open the current estimate from its workfile and edit normally.

- **Save to Workfile** in the summary updates the current estimate.
- **Save as Supplement & Make Current** in the top-right menu saves the full
  edited document as a numbered supplement and makes it the current estimate.
- Saving while in Supplement mode also saves a supplement as current.
- **Save Draft** still exports the editable copy to the computer.

The full revised total replaces the previous job total; it is not added to it.
Linked revenue gross and profit update while receipt expenses, labor, payments,
customer identity and workfile notes remain unchanged. Prior editable versions
and their PDF references are retained in the cloud record's estimate history.
Invoices and ordinary mobile supplement saves keep their existing behavior.

Both saves reuse the existing administrator-only document API, private PDF
storage, idempotent save identifiers and conditional cloud writes. Fresh cloud
context prevents display-only file-number normalization causing a false conflict.
Genuinely changed estimates are rejected rather than overwritten. Failed saves
retain the editor contents; retry the same save before closing the page.

Previously issued customer portal links remain pinned to their original PDFs.
Create a new portal link when sharing a revised estimate with a customer.

The line-note popup is positioned within the visible portion of the embedded
estimator, not the center of its full document. It follows viewport resizing
without changing either page's scroll position.

Verification uses synthetic records only. No customer workfile is changed by
the test fixture or automated tests.
