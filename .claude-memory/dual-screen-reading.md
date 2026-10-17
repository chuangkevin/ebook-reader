# Dual-screen reading

- `pageLayout` is a local browser preference per reader, stored as `readflix.reader.pageLayout.<readerId>`; it is intentionally not sent to the settings API.
- Default is `single`. `spread` is enabled only at viewport widths of at least 768 CSS pixels; narrower screens render one page.
- EPUB uses foliate paginator two-column sizing; PDF presents paired pages and advances by spread; TXT uses two CSS columns.
- Surface Duo hinge spacing uses CSS `viewport-segment-*` environment values when available. Unsupported browsers use a 36px gap.
- Physical Surface Duo behavior still needs device verification.
