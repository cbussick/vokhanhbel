# Group Cards with Topics inside a Collection

[ADR-0012](0012-group-cards-into-collections.md) keeps every Card in exactly one Collection so front
uniqueness, Review queues, and deletion stay unambiguous. The Learner also needs overlapping named
subsets inside a language (animals vs food) and a Review Session of that subset, without mixing
languages. A Topic is that subset: it belongs to one Collection (1:N), Cards join many Topics or none
(N:M), and a Topic never spans Collections. Nested Collections cannot express overlap; making
Collection itself N:M would force a new uniqueness rule. Tags-as-filters-only would not be a named
thing the Learner reviews.

Deleting a Topic never deletes Cards. Moving a Card to another Collection drops its Topics. Deleting
a Collection still requires it empty of Cards; its Topics go with it. Topic names are unique per
Collection. Empty Topics are allowed. On the Cards screen, Topics filter the Collection list (chips, including
Alle). On the Review home, Topics appear nested under their Collection, never as siblings of other
Collections.

A Topic uses a small shared set of generic icons (animal, food, travel, people, and later siblings),
not flags, and is not composited with the Collection icon: the Collection is already on screen.
