# Destination configuration templates

Copy examples into `config/destination/local/` and edit the copies on the destination computer. That directory is ignored. Never place credentials in these JSON files; credentials belong only in the destination `.env` or an approved secret manager.

An `approved` record is a human governance decision, not a switch an AI agent may invent. Replace every example identifier, date, URL and limit with the exact reviewed route before enabling it.

Available templates:

- `youtube-approval.example.json` and `youtube-batch.example.json`;
- `gemini-approval.example.json`;
- `classification-job.example.json`;
- `embedding-job.example.json`.

The free Google Play and Apple App Store store-review routes are deliberately disabled and need no token. Apify is not part of the store-review path.
