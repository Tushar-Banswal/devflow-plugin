---
name: clean-code
description: >
  Applies Clean Code principles when writing or reviewing any source file.
  The DEVELOPER activates this skill after every implementation to self-review
  all changed files before reporting back to the REVIEWER.
---

# Clean Code Self-Review Checklist

Run through every section for every file you wrote or modified.

---

## Naming

- [ ] All variable, function, and class names are **intention-revealing** — a reader understands the purpose without a comment
- [ ] No single-letter names except loop counters (`i`, `j`, `k`)
- [ ] Booleans use `is`, `has`, `can`, `should`, `did` prefixes
- [ ] Functions are named as **verbs** (`getUserById`, `validateToken`)
- [ ] Classes and types are named as **nouns** (`UserRepository`, `AuthToken`)
- [ ] No abbreviations unless universally understood (`id`, `url`, `http`)

---

## Functions

- [ ] Each function does **ONE thing** only
- [ ] Function body is **≤ 20 lines** (flag longer functions with a comment)
- [ ] **≤ 3 parameters** — if more are needed, use an options object
- [ ] No side effects in query/getter functions
- [ ] All return types are explicit (no implicit `any`)
- [ ] No boolean flags used as parameters to switch behaviour — split into two functions instead

---

## Error Handling

- [ ] Every error path is caught and handled with a **descriptive, actionable message**
- [ ] No empty `catch` blocks — at minimum log the error with context
- [ ] No `any` type casts used to suppress type errors
- [ ] Network/IO failures propagate or degrade gracefully — never silently swallowed
- [ ] User-facing error messages never expose internal stack traces or file paths

---

## Code Hygiene

- [ ] No unused imports, variables, constants, or type definitions
- [ ] No commented-out code blocks
- [ ] No `TODO` or `FIXME` without a linked issue reference
- [ ] No `console.log`, `print`, or debug output left in committed code
- [ ] No magic numbers or strings — extract to named constants

---

## Abstractions

- [ ] Duplication extracted into a shared function only when it appears **≥ 2 times** (DRY)
- [ ] No premature abstraction — don't build a framework for one use case (YAGNI)
- [ ] Each module, class, and file has **one clear responsibility** (SRP)
- [ ] New abstractions introduced only when they genuinely reduce complexity, not to appear clever

---

## Documentation

- [ ] All exported/public functions have **JSDoc / docstrings** describing purpose, params, and return
- [ ] Complex logic has **inline comments explaining WHY**, not what (code explains what)
- [ ] Public API changes are reflected in any existing README or usage docs

---

## Final Check

After the checklist, ask:
> "Would a developer who has never seen this code understand it in under 2 minutes?"

If yes → pass. If no → identify what needs clarification and fix it.
