# Full-stack rubric (example)

Goal: prevent impressive demos that break in real usage.

## Categories

### Functionality / correctness (critical)
- core flows work end-to-end
- no obvious broken routes/actions
- errors are handled and surfaced sensibly

### Product depth (critical)
- core interactions are not stub-only
- data mutations persist correctly
- key edge cases are handled (at least 1)

### UX / visual polish
- usable layout; no wasted viewport
- navigation and workflows are intuitive

### Code quality / maintainability
- reasonable structure
- minimal duplication
- clear naming
- tests where appropriate

### Security basics (context-dependent, critical when applicable)
- authn/authz boundaries enforced
- input validation / injection basics
- secrets not committed

## Threshold rule
Any critical category below threshold → FAIL.
