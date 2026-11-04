# French expansion: producer provenance, rejections and limitations

Bastian started this version on 4 November 2026: every third reading day, one of the daily three is an original French text, starting gentle and growing harder. Pinching a French word shows its English meaning. Nothing else in the app changed.

Retrieved unchanged UTF-8 plain-text editions from gutenberg.org on 2026-11-04: Daudet, *Lettres de mon moulin* (PG 11770); Hugo, *Les Contemplations* I and II (PG 29843, 29844); Rimbaud, *Œuvres* (PG 56708). They were chosen after a format pre-check of 17 French Gutenberg books. Most were dropped because the plain text writes "oe" where the HTML prints "œ", or because their apostrophes or quotation marks differ. `expand_catalogue_french.py` declares each work by exact source lines, as the world expansion does, and adds `language: "French"` and a reading `level` (1 gentle, 2 medium, 3 harder). No translator is involved. A separate critic, in its own folder with no producer access, extracted the same works from its own HTML downloads (`critic/extract_french.py`). The comparator is unchanged.

## Result: 9 of 26 accepted

Accepted: Daudet, La Mort du Dauphin (1) and Le Sous-préfet aux champs (1); Rimbaud, Sensation (1), Ma Bohème (1), Le Dormeur du val (1) and Le Buffet (2); Hugo, Veni, vidi, vixi (2), Mors (2) and Paroles sur la dune (3).

Excluded, none hand-corrected:
- *La Chèvre de M. Seguin* (producer): an unpaired Gutenberg italic delimiter.
- Eleven other Daudet pieces (Les Étoiles, L'Arlésienne, Le Secret de maître Cornille, Le Curé de Cucugnan, Les Vieux, Les Deux Auberges, Les Trois Messes basses, La Mule du pape, L'Élixir du Révérend Père Gaucher, Installation, Nostalgies de caserne, Le Poète Mistral): the plain text prints section breaks as `* * * *`, while the HTML draws a rule (`<hr>`).
- Four Hugo poems (Demain, dès l'aube; Elle était déchaussée; Vieille chanson du jeune temps; Mes deux filles): the closing date line is indented in the HTML but not in the plain text.
- Rimbaud, *Le Bateau ivre*: the plain text reads "L'aube,exaltée" with no space, and the HTML has the space.

There are no French essays yet. The Claude rule chooses among kinds that still have an unread French work. A later batch should look for French editions whose section breaks, date lines and ligatures agree in both formats.
