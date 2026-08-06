# Evidence ledger

## JSON shape

```json
{
  "claims": [
    {
      "id": "claim-01",
      "statement": "",
      "type": "observation",
      "source_ids": ["source-01"],
      "value": null,
      "unit": null,
      "uncertainty": null,
      "status": "verified",
      "notes": ""
    }
  ],
  "sources": [
    {
      "id": "source-01",
      "title": "",
      "authors_or_institution": "",
      "doi": null,
      "arxiv": null,
      "url": "",
      "published_at": null,
      "accessed_at": "YYYY-MM-DD",
      "dataset_version": null
    }
  ],
  "figures": [
    {
      "id": "figure-01",
      "source_id": "source-01",
      "original_figure": null,
      "creator": "",
      "license": "",
      "credit_line": "",
      "transformations": [],
      "reuse_status": "verified"
    }
  ]
}
```

## Status values

- `verified`: supported by the cited source.
- `qualified`: support exists but wording needs conditions.
- `unresolved`: required source information is missing.
- `contradicted`: source does not support the slide.

Never use `verified` based only on plausible memory.

