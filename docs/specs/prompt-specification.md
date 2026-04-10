# Prompt Specification

## 1. What a Prompt Is

### 1.1 A Prompt Defines Working Context

A prompt is not merely a list of commands. It is a definition of the working context in which a language model interprets and executes a task.

A prompt shapes what the model understands as:
- relevant
- important
- permissible
- successful

### 1.2 A Prompt Is Closer to a Task Contract Than a Script

For capable language models, prompt writing is usually better treated as defining a task contract than writing a script to be reenacted.

The prompt should communicate the problem space rather than prematurely collapsing it into a narrow procedure.

### 1.3 Why This Matters

Language models are context-conditioned systems. They respond to framing, constraints, examples, and motivation, not only to imperative wording.

Excessive procedural prescription can suppress useful reasoning, adaptation, and generalization.

### 1.4 Scope of This Specification

This document defines a general prompt-writing specification applicable across prompt-bearing artifacts:
- agent prompts
- skill prompts
- role prompts
- direct human-to-AI prompts
- other prompt-like instructional interfaces

This document is not:
- a collection of prompt templates
- a prompt trick catalog
- a model-specific optimization guide
- a detailed operating procedure for every prompt authoring scenario
- a replacement for artifact-specific specifications such as role document structure or metadata definitions

---

## 2. Best Practices

### 2.1 Describing the situation is better than issuing isolated commands because LLMs reason from context, not from command syntax alone

#### What this means

A prompt should explain the task environment, the relevant background, or the operational setting. The model should understand what situation it is acting within, not only what local action is being requested.

#### Why this usually works

Isolated commands often leave the model to infer missing context. Missing context tends to produce generic, brittle, or misaligned behavior. Background information improves the model's ability to select relevant tradeoffs and infer unstated but natural implications.

This does not fully apply when tasks are extremely narrow and self-evident, or when repetitive structured pipelines already supply the surrounding context elsewhere.

#### Good example

```
You are analyzing customer feedback for a quarterly product review. The feedback comes from enterprise customers who have been using the product for at least six months. Your goal is to identify recurring pain points that affect user retention.

Analyze the following feedback messages and extract the top three recurring issues.
```

#### Improvable example

```
Analyze the following feedback messages and extract the top three recurring issues.
```

This prompt names the task but omits why the task exists or what situation it belongs to. The model has no context about the audience, the purpose, or what "recurring issues" should prioritize.

#### Bad example

```
Extract issues from feedback.
```

A bare imperative with no meaningful context. The model must guess what "issues" means, what format is expected, and what the output will be used for.

---

### 2.2 Describing the desired outcome is better than prescribing the full procedure because capable models often perform better when the solution path is not prematurely fixed

#### What this means

A prompt should state what success looks like. It should define the intended result more clearly than it defines the exact path to reach that result.

#### Why this usually works

Strong models can often discover a better path than the prompt author's first procedural guess. Over-prescribed procedure can turn a useful model into a narrow executor of possibly suboptimal steps. Outcome-oriented prompting preserves intelligence while still aligning effort toward a defined objective.

This does not fully apply when tasks need procedural rigidity for safety, reproducibility, auditability, or compatibility, or when weaker models need more scaffolding for certain task types.

#### Good example

```
Your goal is to identify the root cause of the test failure and produce a fix that passes all tests.

The fix should be minimal, well-tested, and easy to verify. Focus on correctness over cleverness.
```

#### Improvable example

```
Your goal is to identify the root cause of the test failure and produce a fix.

First, read the test file. Then inspect the implementation. Then check for edge cases. Then write the fix.
```

This prompt gives a rough workflow but centers the procedure more than the outcome. The steps may not be optimal for all failure types.

#### Bad example

```
Follow these steps exactly:
1. Read test file
2. Read implementation file
3. Identify the failing assertion
4. Modify the implementation to pass the assertion
5. Run tests
6. If tests fail, repeat from step 3

Do not deviate from this procedure.
```

This prompt forces a detailed procedure without establishing why that exact procedure is necessary. It removes the model's ability to adapt to the actual failure mode.

---

### 2.3 Stating boundaries is better than micromanaging every choice because constraints can align behavior without suppressing useful judgment

#### What this means

A prompt should define the limits that matter:
- what must not happen
- what standards must be respected
- what outputs are acceptable or unacceptable

Boundaries should define the safe or valid solution space.

#### Why this usually works

Boundaries align behavior while preserving flexibility inside the allowed space. Micromanagement attempts to control every choice, even when only a subset of choices truly matters. A constrained but open problem space is often more effective than a tightly scripted one.

This does not fully apply when some deterministic workflows genuinely require step-level control, or when tool protocols and strict schemas leave little room for discretionary execution.

#### Good example

```
Generate a summary of the research paper.

Requirements:
- Length: 3-5 sentences
- Audience: Non-expert readers
- Avoid jargon unless you define it inline
- Do not include citations or references
```

#### Improvable example

```
Generate a summary of the research paper.

First, read the abstract. Then read the introduction. Then read the conclusion. Then write exactly 4 sentences. Use simple words. Do not use any technical terms.
```

This prompt mixes boundaries with unnecessary local instructions. The step-by-step reading order is not a meaningful constraint.

#### Bad example

```
Generate a summary of the research paper.

Sentence 1 must describe the problem.
Sentence 2 must describe the method.
Sentence 3 must describe the results.
Sentence 4 must describe the implications.
Each sentence must be between 15 and 25 words.
Do not use passive voice.
Do not use the word "significant".
Do not use abbreviations.
```

This prompt substitutes dozens of micro-rules for a few meaningful constraints. It removes the model's ability to adapt the summary structure to the actual paper content.

---

### 2.4 Explaining why a recommendation exists is better than stating the recommendation alone because reasons generalize better than isolated instructions

#### What this means

If a prompt includes a recommendation, preference, or restriction, it should ideally explain why it exists. The model should understand the purpose behind important guidance.

#### Why this usually works

Reasons allow the model to generalize correctly in cases not spelled out literally. A model that knows why a constraint exists can often make better local decisions than one that only sees the surface rule. Motivation clarifies which parts of the prompt are essential and which are incidental.

Not every small instruction needs a full explanation. Extremely obvious or low-impact guidance may not justify added prompt length.

#### Good example

```
When generating code examples, prefer explicit variable names over abbreviations because the examples will be read by junior developers who are still learning the codebase conventions.
```

#### Improvable example

```
When generating code examples, prefer explicit variable names over abbreviations.
```

This prompt provides a useful recommendation but leaves the motivation implicit. The model does not know whether this is a style preference, a readability concern, or a compatibility requirement.

#### Bad example

```
NEVER use abbreviations in variable names.
```

This prompt imposes a rigid restriction with no explanation of purpose. The model cannot judge when the restriction is truly important versus when it is incidental.

---

### 2.5 Treating a procedure as a preferred default is better than treating it as the only valid path because prompts should guide the model without trapping it in avoidable rigidity

#### What this means

Prompts may recommend a method. But unless rigidity is truly required, a method should usually be framed as a strong default rather than an exclusive legal path.

#### Why this usually works

Good prompts can guide without freezing judgment. A recommended default preserves accumulated experience while still allowing the model to improve on that path when appropriate. This avoids the false choice between total control and total vagueness.

Certain procedures must be mandatory due to safety, compliance, tool semantics, deterministic system requirements, or compatibility with existing workflows.

#### Good example

```
Your goal is to debug the failing test and produce a fix.

A reliable approach is to first examine the test expectations, then trace through the implementation to identify where the actual behavior diverges from the expected behavior. This usually surfaces the root cause faster than editing code speculatively.

If you discover a more direct path to the root cause, you may follow it instead.
```

#### Improvable example

```
Your goal is to debug the failing test and produce a fix.

First examine the test expectations, then trace through the implementation to identify where the actual behavior diverges.
```

This prompt recommends a method but does not clarify whether deviation is allowed. The model may treat it as mandatory even when a better path exists.

#### Bad example

```
Your goal is to debug the failing test and produce a fix.

You MUST follow this procedure:
1. Read the test file
2. Read the implementation file
3. Identify the divergence point
4. Write the fix
5. Run the test

Do not use any other debugging approach.
```

This prompt turns a heuristic into an unexplained absolute command. It removes the model's ability to adapt to the actual failure mode.

---

## 3. Exceptions

### 3.1 This Specification Is Not Against Procedure

This document does not claim that procedural prompting is always wrong.

It claims that procedural prompting should not be the default form when a more contextual and outcome-oriented formulation would work better.

### 3.2 Legitimate Reasons for Stronger Procedural Guidance

Stronger procedural guidance is justified when:
- safety-critical workflows require deterministic execution
- deterministic formatting or schema compliance is mandatory
- strict tool invocation rules must be followed
- mandatory compliance processes exist
- fragile integration environments leave little room for variation
- audit and reproducibility requirements demand exact replication

### 3.3 Even Then, Justification Still Matters

Even when procedure is mandatory, explaining why the procedure exists helps the model:
- understand which parts are truly non-negotiable
- make better decisions in edge cases not explicitly covered
- avoid misapplying the procedure to situations where it does not apply

The question is not whether a prompt contains procedure. The question is whether the level of procedure is justified by the task.

---

## 4. Self-Application

### 4.1 This Specification Is Itself a Prompt Artifact

A prompt-writing specification is itself part of the prompt ecosystem. Therefore, this document should embody the same quality standards it recommends.

### 4.2 Consequence

This document should prefer explanation over command accumulation. It should justify its own recommendations. It should avoid becoming a rigid cookbook while claiming that rigid cookbooks are inferior.

### 4.3 Editorial Implication

The writing style of this specification should itself model:
- contextual explanation
- clear intent
- explicit boundaries
- justified guidance
- limited and purposeful procedural language

---

## Closing Position

Better prompts do not attempt to remove all model judgment. Better prompts define the right problem, the right goal, and the right limits.

When a method is recommended, it should usually be recommended as informed guidance, not as unnecessary confinement.

Prompt writing is therefore best understood not as command writing for a machine, but as task framing for a capable context-conditioned system.
