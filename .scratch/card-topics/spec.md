# Topics inside a Collection

Status: ready-for-agent

## Problem Statement

The Learner wants overlapping named subsets inside a language Collection (animals vs food) and a
Review Session of that subset, without mixing languages or splitting a Card across two homes.

## Solution

Keep Collection as the exclusive home of every Card (ADR-0012). Add Topic (German UI: Thema): a named
grouping of Cards inside one Collection. A Card may belong to many Topics in its Collection, or to
none. A Topic never spans Collections (ADR-0013).

## Invariants

- Collection membership stays 1:N. Front uniqueness stays per Collection.
- Topic belongs to one Collection (1:N). Card ↔ Topic is N:M, constrained to that Collection.
- Deleting a Topic never deletes Cards. Join rows for that Topic go away.
- Moving a Card to another Collection drops its Topics.
- Deleting a Collection still requires it empty of Cards; its Topics are soft-deleted with it.
- Topic names are unique among active Topics in that Collection.
- Empty Topics are allowed.
- Additive migration: old clients omit `topicIds`; old Review snapshots parse without them.

## Learner-facing behavior

1. On a Collection’s Card list: chips **Alle** + each Topic (icon + name) filter the list. A control
   creates a Topic. Selecting a Topic allows renaming or deleting it. Search applies to the filtered
   list. Cards in a Topic still appear when Alle is selected.
2. Creating a Card from a Collection defaults Collection to that Collection. If a Topic chip is
   selected, that Topic starts selected. The Card dialog has a multi-select with chips under
   Collection, listing only Topics of the chosen Collection. Changing Collection clears Topics.
3. Review home: each Collection is a block. The Collection row starts a Review Session of every due
   Card in that Collection. Nested Topic rows start a Review Session of due Cards in that Topic.
   Topics are never siblings of other Collections. A Card in two Topics is due on both rows and on
   the Collection row. The global start control still reviews every due Card.
4. Topic icons are a small shared generic SVG set (no flags), not composited with the Collection icon.

## Out of scope

Nested Collections, N:M Collection membership, tags as a separate concept, deleting Cards when
deleting a Topic, Topic review start from the Card list.
