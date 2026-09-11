# Project guidance

- Keep inventory processing local. Never add analytics, external CSV uploads, or API transmission of asset data.
- Never log full asset records, assigned-user names, serial numbers, or asset IDs.
- Use synthetic records only in tests.
- Keep filtering options derived from normalized data, and keep manufacturer/model dependency intact.
- Use accessible labels, focus states, text statuses, and keyboard behavior for new controls.
- Preserve the privacy and authentication warning in README.md when changing deployment behavior.
