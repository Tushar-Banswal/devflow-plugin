---
name: architectural
description: >
  Architectural review checklist for the REVIEWER. Activate when evaluating
  module boundaries, dependency direction, coupling, cohesion, and design
  pattern usage. Apply to any change that touches module interfaces, adds
  new abstractions, or crosses layer boundaries.
---

# Architectural Review Checklist

---

## Separation of Concerns

- [ ] Business logic is **not mixed** with I/O, HTTP handling, or DB access in the same function/class
- [ ] Controllers / route handlers are **thin** — they delegate to service/use-case layer
- [ ] Data access is **encapsulated** in a repository or DAO layer — no raw SQL/ORM queries scattered in business logic
- [ ] Presentation layer has no direct dependency on data access layer

---

## Dependency Direction

- [ ] Dependencies flow **inward**: domain ← application ← infrastructure (clean architecture / hexagonal)
- [ ] No **circular dependencies** introduced between modules or packages
- [ ] High-level business modules do **not** import low-level implementation details directly
- [ ] New code depends on **abstractions** (interfaces, protocols), not concrete classes where the context warrants it

---

## Coupling & Cohesion

- [ ] New code is **loosely coupled** — it does not reach into other modules' internals or private state
- [ ] Each module is **highly cohesive** — all its elements relate to one clear concept
- [ ] Module boundaries are crossed through **public interfaces** or dependency injection, not by importing internals
- [ ] No "God objects" or "God modules" created — modules that do too many unrelated things

---

## SOLID Principles

- [ ] **SRP**: each class/module has one reason to change
- [ ] **OCP**: new behaviour is added via extension, not by modifying stable code
- [ ] **LSP**: derived types can substitute for their base types without breaking behaviour
- [ ] **ISP**: interfaces are narrow and focused — clients don't depend on methods they don't use
- [ ] **DIP**: high-level modules depend on abstractions, not concrete implementations

---

## Project Rule Compliance

- [ ] All architectural decisions respect constraints defined in **CLAUDE.md / AGENTS.md**
- [ ] No new architectural pattern introduced without user approval
- [ ] File placement follows the project's existing directory conventions
- [ ] New modules are placed in the layer they belong to, not wherever is convenient

---

## Extensibility

- [ ] Future similar changes will be **easier** with this structure, not harder
- [ ] Feature flags or configuration used for optional capabilities — not hard-coded switches
- [ ] The change does not create **implicit coupling** that will cause pain in 6 months

---

## Rejection Triggers

Reject if any of the following are introduced:

- Circular dependency between modules → **REJECT**
- Business logic written directly in a route handler or controller → **REJECT**
- Direct DB/ORM query in business logic layer (bypassing repository) → **REJECT**
- A new God object (class/module with > 5 unrelated responsibilities) → **REJECT**
