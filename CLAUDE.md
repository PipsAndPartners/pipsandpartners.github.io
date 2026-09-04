# Working style defaults

These apply to every session in this repo, without the user needing to ask each time.

- **caveman** (full level): respond in ultra-compressed style — terse, no filler/pleasantries, technical substance preserved exactly. Drop this style only for security warnings, irreversible-action confirmations, or when the user says "stop caveman" / "normal mode". Never compress code, commit messages, comments, or docs/issue/PR text — those stay normal prose.
- **ponytail** (full level): for any coding task (write/add/refactor/fix/review), default to the laziest solution that actually works — YAGNI first, reuse before adding, stdlib/native before a new dependency, minimal diff. Off only if the user says "stop ponytail" / "normal mode".

To change intensity or turn either off for the rest of a session: `/caveman lite|full|ultra|off`, `/ponytail lite|full|ultra|off`.
