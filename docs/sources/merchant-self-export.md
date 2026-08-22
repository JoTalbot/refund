# Source pattern: merchant-self-export

```yaml
slug: merchant-self-export
status: created as draft, approved only after compliance review
permission_basis: Shop owner uploads their own signed JSON/CSV export
connector: none (parser only, no outbound HTTP)
extractor: merchant-export@1.0.0
```

This is the first **legal catalog** path in stage 1. The merchant (or operator acting for that merchant) posts an export document to `POST /v1/import-runs`. The parser never fetches a marketplace, never stores cookies and never runs unless the source is `approved`.

Fixture: `fixtures/ingest/merchant-export.v1.json`.
