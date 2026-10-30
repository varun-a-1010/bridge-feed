---
type: Evidence
title: Ranker evaluation
description: Reproducible replay of recorded Qloo rankings for simulated readers.
timestamp: 2026-10-30
---

Run `npm run evaluate`. 200 simulated readers, each with four random stances and four
random catalog interests, replayed against recorded Qloo rankings. This measures how the ranker
behaves. It says nothing about how real people respond.

The catalog was deliberately chosen to be mostly absent from the sample posts, so that bridges
have to be earned. The literal-match figure is therefore a property of this corpus, not a general
finding. A reader who searches for a title that a post names will see literal overlap, and that
overlap still cannot create a bridge on its own.

| Measure | Result |
|---|---|
| Sample posts through the live agent | 48 |
| Posts with at least one Qloo entity | 47 of 48 |
| Confirmed Qloo entities | 64 |
| References left unresolved | 7 |
| Recorded Qloo rankings | 245 |
| Readers with at least one bridge | 100.0% |
| Bridges per reader | 4.13 |
| Opposing posts that cleared the cutoff | 30.9% |
| Bridges sharing no title with the reader's interests | 100.0% |
| Opposing posts literal matching alone would find, per reader | 0.00 |
| Distinct posts reached across all readers | 41 of 48 |
| Failed Qloo queries during the replay | 0 |
