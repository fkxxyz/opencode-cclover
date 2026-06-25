# Domain Maintenance Best Practices

## Purpose

This specification defines how long-lived employees maintain responsibility domains so future work sessions can route and decompose tasks from curated domain memory instead of reading subordinate-owned business files.

Domain maintenance is part of task delivery. Hiring, handbook updates, work-session creation, and result integration are organizational tools for completing the assigned task with stable knowledge and accountable delegation.

## Domain Handbook as Employee Memory

The Domain Handbook is the employee-maintained context document for its responsibility domain. It is the employee's long-lived memory of the domain and must be updated whenever a work session discovers reusable structure, routing knowledge, risks, validation paths, or obsolete guidance.

A useful Domain Handbook lets a future work session understand the domain's global shape before touching subordinate-owned implementation details.

## One-Layer Domain Decomposition

When a domain must be decomposed into subordinate employees, split only the immediate child layer of the current domain.

For directory-shaped domains, each subordinate employee must own exactly one immediate child directory unless the domain is not directory-shaped. The parent keeps the global view of the current domain and must not skip levels when assigning responsibility.

This one-layer rule preserves clear ownership boundaries: the parent understands the current domain, and each child understands its own next-level domain.

## Parent-Owned Global Files

Root-level files are assigned by meaning, not by path alone.

The parent employee must maintain files that express the current domain's global knowledge, such as:

- index or navigation documents;
- domain overview documents;
- specifications for the current domain;
- central data structures or interfaces that define the domain model;
- architecture, routing, or integration files that explain how child domains connect.

Files that mainly contain concrete business logic for a child domain must be assigned to the relevant subordinate employee.

A subordinate-owned business file is a file whose primary purpose is implementing behavior inside an immediate child domain, rather than describing, indexing, integrating, or defining the parent domain's global model.

The parent must reference the global files it owns from its Domain Handbook so future work sessions know which files are safe and expected to read for global context.

## Domain Handbook Content Standard

A Domain Handbook must be detailed enough that a future work session can decompose ordinary multi-file tasks without reading subordinate-owned business files.

Include the information needed for routing and global control:

- immediate child directories and what each child domain owns;
- important parent-owned files and why they represent global domain knowledge;
- architecture view of the current domain;
- data-flow view across child domains;
- business-logic or responsibility-flow view at the domain level;
- sequence or process views for common cross-domain operations;
- common task categories and how to route them into employee work-session packages;
- a task-routing table mapping common change categories to child domains, parent-owned files, validation paths, and expected work-session package boundaries;
- validation methods and integration risks for the domain.

Use diagrams when they reduce ambiguity. Mermaid diagrams are appropriate for architecture maps, data-flow diagrams, sequence diagrams, and task-routing flows.

## No Subordinate Business File Reads for Decomposition

A parent work session must not read subordinate-owned business files merely to decide how to decompose a task.

The parent may read files it owns as global domain context. The parent may also read source references explicitly included in its context only when those references are part of the parent responsibility boundary; context inclusion alone must not bypass the no-read rule for subordinate-owned business files.

If the Domain Handbook is too weak to support decomposition without reading subordinate business files, the current work session must treat that as a domain-memory defect, not as permission to continue ad hoc exploration.

## Handbook Repair and Clean Restart

When a work session cannot decompose an assigned task because the Domain Handbook lacks required routing knowledge, it may temporarily read the minimum necessary subordinate files to repair the Domain Handbook.

After repairing the Domain Handbook, the current work session must not continue decomposing or executing the original task. It must create a child Employee Work Session for the same employee with the original task, so the new session starts from the repaired handbook without polluted exploratory context.

The restart session description must preserve the original task and mention that the Domain Handbook was repaired so the new session routes from handbook memory, not from the repair session's exploratory findings.

The repair session's deliverable is the improved Domain Handbook and the clean restart, not completion of the original task.

## Multi-File Task Delegation

A task touching two or more files must be handled through subordinate employee organization rather than direct parent execution. This applies even when multiple files are parent-owned; the parent may directly handle only single-file tasks.

The parent employee is responsible for global control:

- decompose the task into child-domain work packages;
- hire or reuse subordinate employees for immediate child domains;
- assign each subordinate the correct context paths, including supervisor contract, Domain Handbook, and source references in the correct order;
- create and monitor child Employee Work Sessions;
- integrate child results;
- report completion, blockers, and unresolved risks upstream.

Single-file tasks may be handled directly when the file belongs to the parent domain and the task does not require subordinate-domain understanding.

## Accountability

A parent employee is accountable for subordinate output quality. Delegating work changes execution location; it does not transfer responsibility away from the parent.

The parent must verify that child results satisfy the original task, domain boundaries, and integration needs before reporting completion upstream.
