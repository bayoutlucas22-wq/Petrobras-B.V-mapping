# Petrobras B.V. Network Compliance and Money-Flow Correlation Report

## Executive Summary

This review treats the Petrobras B.V. map as a governed money-flow network, not a registry dump. The analytical objective is to correlate Dutch B.V. entities, normalize aliases, and identify where value concentrates across upstream assets, drilling vehicles, trading wrappers, and adjacent service providers.

The pattern is structurally coherent for an offshore operating model, but it is also compliance-sensitive by design:

- large values are concentrated in a limited set of Dutch B.V. vehicles
- many of those vehicles are single-purpose upstream SPVs
- some entities appear under multiple labels or suffix variants
- a meaningful subset of spend uses direct award, exemption, or narrow procurement pathways

That combination does not prove misconduct. It does, however, justify enhanced governance, documented alias resolution, and continuous monitoring under an ISO 37301-style compliance management system.

## Standards Lens

ISO 37301 is the right governance frame for this work because it is a compliance management systems standard focused on establishing, evaluating, maintaining, and improving an effective CMS. ISO describes it as grounded in good governance, proportionality, transparency, and sustainability, and notes that it can integrate with ISO 37001 anti-bribery controls.

Relevant ISO references:

- ISO 37301 overview: https://www.iso.org/standard/75080.html
- ISO 37301 introduction: https://committee.iso.org/sites/tc309/home/projects/published/iso-37301-compliance-management.html
- ISO publication note: https://committee.iso.org/sites/tc309/home/news/content-left-area/news-and-updates/iso-37301-published.html

For this project, ISO 37301 translates into four control questions:

1. Do we know what each B.V. actually is economically?
2. Can we prove why two labels were merged or kept separate?
3. Can we explain the value flow concentration by entity and by project?
4. Can we show a repeatable review process that improves as new evidence arrives?

## Decision Tree for Entity Resolution

Use the following resolution path for every B.V. label encountered in the source data.

### Step 1: Normalize the label

Apply basic normalization before any comparison:

- trim whitespace
- standardize punctuation
- normalize casing
- remove trivial suffix noise where appropriate
- map known alias patterns such as `- PNBV`

### Step 2: Check for exact economic identity

Ask whether two labels represent the same legal/economic node.

Merge only when there is evidence of:

- identical project context
- matching asset / field reference
- same parent structure
- same contract purpose over time
- consistent values and counterparties

### Step 3: Check for alias risk

Flag the label pair for manual review if any of the following are present:

- minor spelling changes with large value differences
- suffix variants that may hide the same economics
- one label used for legal correspondence and another for contracting
- one label used in upstream asset charters and another in reimbursements or ancillary spend

### Step 4: Assign a resolution status

- `confirmed` if the identity is economically established
- `partial` if the link is plausible but not fully proven
- `unresolved` if the evidence is insufficient or conflicting

### Step 5: Record the reason

Every merge or non-merge decision should preserve:

- original label
- normalized label
- source row count
- value totals
- contract purpose examples
- reason for the final decision

## Money-Flow Scoring Model

Each entity should receive a 100-point priority score. The purpose is not to accuse; it is to rank governance attention.

### 1. Value concentration - 40 points

Score high when the entity controls:

- a very large aggregate spend
- one or more outsized individual contracts
- a large share of a project’s total value

### 2. Recurrence - 20 points

Score high when the entity appears:

- across multiple years
- in multiple contracts
- in repeated operational cycles
- in recurring reimbursement or service patterns

### 3. Structural importance - 15 points

Score high when the entity is:

- an FPSO SPV
- a drilling vehicle
- a field-linked operating wrapper
- a trading or holding conduit for Petrobras activity

### 4. Alias and opacity risk - 15 points

Score high when the entity has:

- alternate spellings
- suffix variants
- near-duplicate names
- uncertain relationship to the economic asset

### 5. Compliance sensitivity - 10 points

Score high when the entity is associated with:

- direct award or exemption routing
- long-dated contracts
- repeated addenda
- limited competition
- reimbursement-heavy patterns

## Preliminary Governance Observations

### A. Concentration is real

The largest upstream values are concentrated in a small set of Dutch B.V. structures tied to FPSOs, drilling units, and field-linked assets. That is normal in offshore capital models, but it creates governance concentration risk.

### B. Alias handling is not optional

Labels such as `Petrobras Netherlands B.V.` and `Petrobras Netherlands B.V. - PNBV` must be treated as a controlled resolution problem. If aliases are left unmanaged, the network will misstate totals, overcount entities, and obscure the real route of value.

### C. Upstream and adjacent spend are different risk surfaces

The upstream SPVs absorb the largest values. Adjacent vendors may be smaller, but they matter because they reveal support spend, recurring service dependencies, and potential routing points that deserve separate scrutiny.

### D. Legal basis matters

Rows that rely on exemptions, sole-source logic, or narrow procurement pathways should be treated as higher-compliance-sensitivity nodes. The issue is not the legal route alone; it is the combination of route, concentration, duration, and recurrence.

## Red Flags for Review

These are not findings of wrongdoing. They are governance flags that deserve structured review:

- one entity capturing very large value through a small number of contracts
- multiple B.V. names that may be the same economic actor
- long-duration offshore charters with substantial financial exposure
- reimbursement or ancillary expense flows concentrated in a limited wrapper
- recurring direct-award logic without visible competition
- service spend that is small individually but highly repetitive

## Reporting Logic

To make this auditable, every entity should be reported with:

- normalized name
- alias set
- category: upstream, adjacent, trading, or unresolved
- contract count
- aggregate value
- highest-value contract
- procurement route distribution
- time span of observed activity
- resolution confidence

## Governance Actions

If this were running inside a mature compliance program, the next controls would be:

1. Maintain a canonical entity registry.
2. Require explicit approval for any new alias merge.
3. Track spend concentration by project and by legal wrapper.
4. Review direct-award / exemption-heavy entities on a scheduled basis.
5. Escalate unresolved aliases that affect money-flow interpretation.
6. Preserve source-row traceability for every normalized label.

## Step-By-Step Understanding

This is the cleanest way to explain the study logic in sequence:

1. Start with the raw source rows and the nominal values they report.
2. Normalize entity labels so `Petrobras Netherlands B.V.`, `Petrobras Netherlands B.V. - PNBV`, and similar variants are not treated as separate economic realities unless evidence proves otherwise.
3. Group the rows by contract purpose, counterparty, and procurement route.
4. Separate upstream asset vehicles from adjacent vendors and service providers.
5. Look for value concentration, recurrence, and long-duration exposure.
6. Keep the legal basis attached to each row so the procurement path stays visible.
7. Compare the nominal totals against the actual economic story, especially when currencies are mixed and FX conversion is missing.

## Macaé Context

Macaé matters because it is one of the operational centers where Petrobras offshore execution, vendor coordination, and support activity converge. In practical terms, that means Macaé is not just a geographic reference; it is part of the control surface where contracts, services, and offshore operations meet.

For this study, Macaé should be treated as an operational lens:

- it helps explain why offshore-linked entities and support wrappers cluster around the same commercial ecosystem
- it gives the study a concrete place to anchor the offshore operating model
- it shows how governance pressure concentrates where field operations, logistics, and procurement intersect

If the 2017 reference is the point where a Petrobras executive departure changed the local operating picture, it should be framed carefully in the study as a timeline marker unless a named source is added. In other words, use it as context for organizational transition, not as a standalone allegation.

### Suggested wording for the study

`Macaé is the operational hinge: the offshore ecosystem, the vendor network, and the governance burden all converge there. If 2017 marked the departure of a Petrobras executive, that year becomes a useful transition point for the study timeline, but it should be documented with a named source before it is treated as fact.`

## Bottom Line

The Petrobras B.V. map is not just a map of companies. It is a governed money-flow network. The compliance value is in the correlation layer: who absorbs spend, how much is recurring, which structures are upstream-critical, and where alias ambiguity could distort the picture.

If the objective is pure governance, the standard is simple:

- do not overstate certainty
- do not collapse distinct economics
- do not let alias noise hide concentration
- do not review value without keeping the procurement path attached

That is the convergence point: a precise entity model, a defensible resolution process, and a compliance posture that can stand up to ISO 37301-style scrutiny.
