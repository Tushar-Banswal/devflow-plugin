---
name: security
description: >
  Security review checklist for the REVIEWER. Activate when auditing code
  involving user input, authentication, session management, data storage,
  API calls, file system access, or any external service interaction.
  A single blocking issue found here must result in REJECTED.
---

# Security Review Checklist

Work through every applicable section. A ✗ on any **MANDATORY REJECTION** item = immediate REJECTED.

---

## Input Validation & Sanitisation

- [ ] All user-supplied input is **validated** (type, range, format) before use
- [ ] All user-supplied input is **sanitised** before rendering in HTML, SQL, shell commands, or file paths
- [ ] No direct string interpolation of user input into SQL queries → use parameterised queries / ORMs
- [ ] No direct string interpolation of user input into shell commands → use argument arrays, not shell strings
- [ ] File paths from user input are **normalised** (`path.resolve`, `path.normalize`) and checked against an allowlist of permitted directories
- [ ] JSON/XML from external sources is parsed with size and depth limits

---

## Authentication & Authorisation

- [ ] Auth tokens / session cookies are validated on **every** protected endpoint — not just at login
- [ ] No hardcoded credentials, API keys, tokens, or secrets anywhere in source code
- [ ] Secrets are read from environment variables or a secrets manager (never from config files committed to git)
- [ ] Role and permission checks are enforced **server-side** — client-side checks are UI only
- [ ] Password reset and MFA flows cannot be bypassed via direct endpoint calls
- [ ] JWTs are validated for signature, expiry, and audience claim before use

---

## Data Handling

- [ ] Sensitive data (PII, passwords, tokens, payment info) is **never logged**
- [ ] Passwords are hashed with bcrypt/argon2/scrypt — never stored plain or with MD5/SHA1
- [ ] Sensitive data is never placed in URL query parameters (appears in access logs and browser history)
- [ ] Database queries filter by the authenticated user's scope — no IDOR (Insecure Direct Object Reference) possible

---

## API Security

- [ ] CORS is configured **restrictively** — not `*` for authenticated routes
- [ ] Rate limiting is applied to all public-facing and auth endpoints
- [ ] HTTP error responses don't leak stack traces, internal paths, or DB schema in production
- [ ] File upload endpoints validate MIME type (server-side, not just Content-Type header), size limit, and store files outside the web root

---

## Dependencies

- [ ] No new dependency added without checking for known CVEs (search `npm audit`, `pip audit`, Snyk, or OSV)
- [ ] Dependency versions are pinned or tracked in a lockfile

---

## Secrets & Configuration

- [ ] `.env` files are in `.gitignore`
- [ ] No secret appears in any log statement, error message, or API response body
- [ ] All cryptographic operations use well-known, maintained libraries — no hand-rolled crypto

---

## MANDATORY REJECTION triggers

Reject immediately (do not continue review) if any of these are found:

- **Hardcoded secret / credential** anywhere in source → **REJECT**
- **SQL injection vector** (string interpolation into query) → **REJECT**
- **Command injection vector** (user input into shell string) → **REJECT**
- **Authentication bypass** possible (missing auth check on protected route) → **REJECT**
- **Stored XSS** vector (unsanitised user input rendered as HTML) → **REJECT**
- **Path traversal** possible (file path not normalised + allowlist checked) → **REJECT**
