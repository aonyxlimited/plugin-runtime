# PluginRuntime

PluginRuntime is an environment-neutral TypeScript runtime for composing and
executing plugin-defined behavior. It provides the mechanics needed to turn
observations into decisions and coordinated actions while keeping domain
vocabulary and external integrations in plugins and consuming applications.

This package is currently a skeleton. The runtime, plugin contracts, message
model, and execution APIs described below are architectural direction, not a
claim that they are already implemented.

## Purpose

PluginRuntime is intended to own reusable runtime mechanics:

- plugin registration and lifecycle management
- immutable messages and causal traces
- scheduling and graph execution
- policy evaluation and arbitration
- capability leases
- execution coordination
- structured execution checks and failure information

The package should remain independent of any particular application, UI,
transport, or service. A consuming system supplies its plugins, schemas,
configuration, and startup composition.

## Package Boundary

PluginRuntime owns the generic runtime kernel and its public contracts. It must
not own concrete integrations such as Twitch, Ollama, StreamElements, Web
Audio, VTube Studio, React, or Tauri.

The intended dependency direction is:

```text
PluginRuntime
  Runtime mechanics
  Plugin contracts
  Messages and traces
  Scheduling and coordination
          ^
          |
Consuming system
  Domain messages and schemas
  Concrete plugins and providers
  Production configuration
  Application lifecycle
```

Runtime construction should not start work as a side effect. Creating a runtime,
registering plugins, starting execution, stopping execution, and releasing
resources should be explicit operations so applications and tests can control
the complete lifecycle.

## Runtime Model

The runtime is trace-driven. A trace is not merely diagnostic metadata; it is
the execution history.

The model is similar to Git:

- messages are immutable commits
- every message has one parent
- every trace has one root
- current runtime state is represented by the trace's leaf nodes
- branches represent concurrent work

Instead of modifying a message in place, a plugin creates a new message whose
parent records the causal relationship.

```text
Fact
  -> Should
    -> Will
      -> Fact
```

This structure is intended to make execution replayable, inspectable, and
explainable without relying on mutable event payloads.

## Semantic Messages

The runtime has three semantic message categories.

### Fact

A `Fact` records an observation of reality, such as a received chat message, a
completed speech request, or a failed provider operation.

### Should

A `Should` records a proposal or decision that an action ought to happen. A
composite proposal is still a `Should`; it is not a separate message category.

### Will

A `Will` records committed execution. It means the runtime has selected a
provider, allocated the required capability, and intends to perform the action.

The expected high-level flow is:

```text
Facts
  -> planners and transformers
  -> Should
  -> composers
  -> policy
  -> arbitration
  -> Will
  -> providers
  -> Facts
```

## Plugin Roles

Plugins own domain vocabulary and participate through explicit roles:

- **Source** creates facts from external or internal observations.
- **Planner** derives `Should` proposals from facts.
- **Composer** combines sibling proposals into a higher-level composite
  `Should`.
- **Policy** accepts or denies proposals according to declared rules.
- **Arbitrator** selects between valid competing providers or plans.
- **Provider** fulfills a committed `Will` and reports the result as facts.

A plugin should declare the messages it consumes and produces. Runtime routing
should be based on those contracts rather than broadcasting every message
through an ordered list of unrelated processors.

Plugins may define:

- message and blackboard schemas
- planners and providers
- composition rules and grouping windows
- domain-specific checks
- private state

Plugin-created work may inherit the same or fewer permissions than its parent,
but never more.

## Composition

Composition is a dedicated plugin responsibility. A composer reasons over
sibling `Should` messages and may propose a higher-level semantic action.

For example:

```text
ShouldSpeak
+ ShouldAnimateLips
+ ShouldShowCaption
        |
        v
ShouldDeliverLine
```

A composite remains a proposal until it is accepted:

- If accepted, its children are superseded by the composite execution.
- If explicitly denied by composite policy, the entire bundle is rejected.
- If no composite handler exists, the composite dissolves and its children are
  released for independent evaluation.
- If a component is rejected, the composite dissolves and the remaining
  components are re-evaluated.

Grouping timing belongs to the composer rather than to a global runtime window.
Composition rules must be declared and traceable so the runtime can explain why
messages were grouped or released.

## Execution Groups

An execution group is a first-class coordination contract represented in the
trace. It is responsible for:

- acquiring capability leases
- enforcing hard and soft requirements
- synchronizing provider startup
- coordinating child execution
- determining overall success or failure

```text
WillExecutionGroup
  |- WillPlayVoice
  |- WillAnimateLips
  `- WillShowCaption
```

If a required child fails, the failure belongs to the group while each child
remains independently inspectable. The initial implementation should support
flat execution groups. Nested groups are architecturally valid but deferred
until the flat model is proven.

## Capabilities and Providers

Providers are selected by capability. Only one provider should satisfy a given
capability for a runtime role unless an execution group explicitly coordinates
multiple distinct capabilities.

Capability leases let the runtime reserve execution authority before producing
a `Will`. This prevents competing providers from committing the same capability
and gives execution groups a concrete synchronization mechanism.

## Checks and Observability

Checks are execution annotations, not additional message categories. Examples
include:

- policy accepted or denied
- arbitration selected a provider
- capability lease granted or rejected
- provider completed or failed
- composite created, dissolved, or superseded

Checks should preserve enough structured context for a debugger to explain how
the runtime reached a decision. They supplement the immutable trace without
changing message history.

## State Ownership

Private plugin state and intentionally shared state are separate concerns.

- Private state belongs to the plugin that owns it.
- Shared blackboard state must have an explicit schema and purpose.
- The blackboard must not become arbitrary global storage.
- The runtime owns execution mechanics, not plugin-defined domain data.

## Integration with AonyxBuddy

AonyxBuddy is an initial consumer of this package, but its production assembly
remains outside PluginRuntime. The client is responsible for constructing the
runtime with concrete source, planner, policy, provider, audio, and avatar
plugins and for connecting runtime lifecycle to the application lifecycle.

The existing AonyxBuddy runtime is an ordered mutable processor pipeline. Its
migration should be incremental: introduce typed semantic messages and explicit
consume/produce contracts first, then move execution to the trace-driven graph.
The new runtime should not require a single disruptive rewrite of active
integrations.

## Implementation Direction

The first implementation work should validate the architecture through a small
vertical slice:

1. Define immutable `Fact`, `Should`, and `Will` message contracts.
2. Define trace identity, parent relationships, roots, and leaves.
3. Define the minimal plugin manifest and registration lifecycle.
4. Route one fact through a planner into a should.
5. Apply policy and arbitration to produce a will.
6. Execute one provider and record its result as a fact.
7. Add structured checks and deterministic tests for the complete trace.
8. Add flat execution groups and capability leases after the basic path works.

Implementation should prioritize deterministic behavior, explicit dependencies,
side-effect-free construction, idempotent cleanup, and tests that do not require
network access, browser APIs, or GUI processes.

## Open Design Work

The architecture still requires concrete APIs for:

- runtime message types and validation
- trace storage and traversal
- plugin manifests and consume/produce declarations
- scheduler behavior and concurrency limits
- execution groups and fulfillment rules
- capability leases
- policy and arbitration results
- persistence, replay, and debugging surfaces

These details should be settled through focused implementation and tests while
preserving the ownership boundaries described above.
