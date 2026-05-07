# Concept Definitions Reference

All 78 grammar concepts across six CEFR levels. Each concept is the atomic unit of the app — it drives the daily session, the grammar map node, the lesson prompt, and the question bank.

---

## Concept object shape

```js
{
  slug:     string   // DB key, URL param, rotation identifier — snake_case
  name:     string   // English name — used in session confirm card subtitle
  nameFr:   string   // Full French name — used as page title and lesson header
  mapLabel: string   // Short display label for the 134px-wide map node card
  rule:     string   // One-paragraph grammar rule — passed to Mistral as lesson/question seed
  formula:  string[] // Tokenised structure — '+' and '→' are operators, '/' separates alternatives
}
```

**Formula rendering:** tokens are rendered as styled pills. `+`, `→`, and `/` are rendered as plain operators between pills, not as pills themselves.

---

## A1 — Beginner (14 concepts)

### `pronoms_sujets` — Subject pronouns
**Les pronoms sujets**
French subject pronouns replace noun subjects: je, tu, il/elle/on, nous, vous, ils/elles. Vous can be singular (polite) or plural. On is widely used in speech instead of nous.
```
je / tu / il / elle / on / nous / vous / ils / elles  +  verbe
```

### `etre_avoir` — Être and avoir
**Être et avoir**
Être (to be) and avoir (to have) are the two foundational verbs in French and the auxiliaries used to form all compound tenses.
```
sujet  +  être / avoir  +  complément
```

### `verbes_er` — Regular -er verbs
**Les verbes en -er**
Regular -er verbs (parler, manger, aimer) follow a predictable pattern in the present tense: drop -er and add -e, -es, -e, -ons, -ez, -ent.
```
radical  +  -e / -es / -e / -ons / -ez / -ent
```

### `articles_def_indef` — Definite and indefinite articles
**Les articles définis et indéfinis**
Definite articles (le, la, les, l') refer to specific nouns. Indefinite articles (un, une, des) refer to non-specific ones. Articles agree in gender and number with the noun.
```
le / la / l' / les (défini)  /  un / une / des (indéfini)  +  nom
```

### `adjectifs_qualif` — Qualifying adjectives
**Les adjectifs qualificatifs**
Qualifying adjectives describe nouns and must agree in gender and number. Most follow the noun; BAGS adjectives (beau, âgé, bon/mauvais, grand/petit) precede it.
```
nom  +  adjectif (accord en genre et nombre)
```

### `negation_base` — Basic negation
**La négation de base**
Basic negation wraps the conjugated verb with ne…pas. In spoken French, the ne is often dropped. Before a vowel, ne becomes n'.
```
ne / n'  +  verbe conjugué  +  pas
```

### `questions_simples` — Simple questions
**Les questions simples**
French offers three question forms: rising intonation (Tu viens ?), est-ce que + declarative order, or inversion (verb-subject). All three are correct; inversion is most formal.
```
est-ce que + sujet + verbe  /  verbe-sujet ?  /  sujet + verbe ? (intonation)
```

### `nombres` — Numbers and quantities
**Les nombres et les quantités**
Cardinal numbers (un, deux, trois…) are used for counting. Note the irregular forms: 70 (soixante-dix), 80 (quatre-vingts), 90 (quatre-vingt-dix). Quantities use de + noun.
```
nombre cardinal  +  nom  /  beaucoup / peu / assez de  +  nom
```

### `prepositions_lieu` — Prepositions of place
**Les prépositions de lieu**
Prepositions of place locate things in space: dans (in), sur (on), sous (under), devant (in front of), derrière (behind), à côté de (next to), entre (between).
```
dans / sur / sous / devant / derrière / entre  +  nom
```

### `adj_possessifs` — Possessive adjectives
**Les adjectifs possessifs**
Possessive adjectives agree with the noun they modify, not the owner: mon/ma/mes, ton/ta/tes, son/sa/ses. Use mon/ton/son before feminine nouns starting with a vowel.
```
mon / ma / mes / ton / ta / tes / son / sa / ses / notre / votre / leur  +  nom
```

### `imperatif_present` — Imperative
**L'impératif présent**
The imperative is used for commands, advice, and requests. It uses the tu, nous, and vous forms without a subject pronoun. For -er verbs, the tu form drops the final -s.
```
verbe (sans pronom sujet)  →  Parle ! / Parlons ! / Parlez !
```

### `genre_accord` — Gender and agreement
**Le genre et l'accord**
All French nouns have grammatical gender (masculine or feminine). Adjectives, articles, and some pronouns must agree with the noun in both gender and number.
```
nom (m/f)  +  adjectif (accord)  /  article (accord)
```

### `cest_il_est` — C'est vs il est
**C'est et il est**
C'est introduces a noun phrase or name (C'est un médecin). Il/elle est introduces an adjective or unmodified profession without an article (Il est médecin.).
```
c'est + article + nom / nom propre  /  il est / elle est + adjectif / profession
```

### `il_y_a` — Il y a
**Il y a**
Il y a means "there is" or "there are" and is invariable. It also expresses elapsed time (il y a deux jours = two days ago). Negative form: il n'y a pas de.
```
il y a  +  nom (existence)  /  il y a  +  durée (ago)
```

---

## A2 — Elementary (15 concepts)

### `passe_compose_avoir` — Passé composé with avoir
**Le passé composé avec avoir**
The passé composé expresses a completed past action. Most verbs form it with avoir + past participle. -er verbs → -é; -ir verbs → -i; -re verbs → -u.
```
sujet  +  avoir (présent)  +  participe passé
```

### `passe_compose_etre` — Passé composé with être
**Le passé composé avec être**
Motion and state-change verbs (DR MRS VANDERTRAMP) and all reflexive verbs use être. The past participle agrees in gender and number with the subject.
```
sujet  +  être (présent)  +  participe passé (accordé)
```

### `imparfait` — Imparfait
**L'imparfait**
The imparfait describes ongoing past states, habitual actions, or background descriptions. Formed from the nous-stem of the present tense + -ais, -ais, -ait, -ions, -iez, -aient.
```
radical (nous-form)  +  -ais / -ais / -ait / -ions / -iez / -aient
```

### `futur_proche` — Near future
**Le futur proche**
The futur proche (aller + infinitive) expresses an action about to happen or planned in the immediate future. It is more informal than the futur simple.
```
sujet  +  aller (présent)  +  infinitif
```

### `verbes_ir_re` — Regular -ir and -re verbs
**Les verbes en -ir et -re**
Regular -ir verbs (finir) add -is, -is, -it, -issons, -issez, -issent. Regular -re verbs (vendre) drop -re and add -s, -s, -, -ons, -ez, -ent.
```
radical -ir  +  -is / -issons…  /  radical -re  +  -s / -ons…
```

### `verbes_irreguliers` — Irregular verbs
**Les verbes irréguliers**
High-frequency irregular verbs must be memorised: aller, venir, prendre, mettre, savoir, pouvoir, vouloir, devoir, faire, voir. Each has its own stem pattern.
```
radical irrégulier  +  terminaisons (variable selon le verbe)
```

### `articles_contractes` — Contracted articles
**Les articles contractés**
When à or de precedes le or les, they contract: à + le = au, à + les = aux, de + le = du, de + les = des. No contraction with la or l'.
```
à + le → au  /  à + les → aux  /  de + le → du  /  de + les → des
```

### `articles_partitifs` — Partitive articles
**Les articles partitifs**
Partitive articles (du, de la, de l') express an unspecified quantity of something uncountable. After negation and quantity expressions, they reduce to de / d'.
```
du / de la / de l'  +  nom indénombrable  →  de / d' (après négation)
```

### `place_adjectif` — Adjective placement
**La place de l'adjectif**
Most adjectives follow the noun. BAGS adjectives (beau, vieux, bon, petit, grand, jeune, joli, mauvais, gros, nouveau) precede it. Some change meaning by position.
```
BAGS + nom  /  nom + adjectif descriptif
```

### `adverbes` — Adverbs
**Les adverbes**
Many adverbs are formed by adding -ment to the feminine adjective. Common irregular adverbs (bien, mal, très, souvent, jamais) must be memorised.
```
adjectif (féminin)  +  -ment  /  adverbe irrégulier
```

### `pronoms_cod` — Direct object pronouns
**Les pronoms COD**
Direct object pronouns replace a noun that directly receives the action: me, te, le, la, nous, vous, les. They precede the conjugated verb, or the infinitive in a two-verb construction.
```
sujet  +  me / te / le / la / nous / vous / les  +  verbe
```

### `pronoms_coi` — Indirect object pronouns
**Les pronoms COI**
Indirect object pronouns replace à + person: me, te, lui, nous, vous, leur. They precede the verb and indicate the recipient. Lui/leur are third-person only.
```
sujet  +  me / te / lui / nous / vous / leur  +  verbe
```

### `adj_demonstratifs` — Demonstrative adjectives
**Les adjectifs démonstratifs**
Demonstrative adjectives (ce, cet, cette, ces) point out specific nouns. Use cet before masculine nouns starting with a vowel or silent h. Add -ci (near) or -là (far) for contrast.
```
ce / cet / cette / ces  +  nom  (+ -ci / -là)
```

### `verbes_pronominaux` — Reflexive verbs
**Les verbes pronominaux**
Reflexive verbs take a reflexive pronoun (me, te, se, nous, vous) that refers back to the subject. In compound tenses they use être, and the past participle typically agrees with the subject.
```
sujet  +  me / te / se / nous / vous  +  verbe pronominal
```

### `comparatif` — Comparative
**Le comparatif**
Comparatives compare two elements: plus…que (more than), moins…que (less than), aussi…que (as…as). Irregular forms: meilleur(e) (better), pire (worse), mieux (better, for adverbs).
```
plus / moins / aussi  +  adjectif / adverbe  +  que  +  complément
```

---

## B1 — Intermediate (15 concepts)

### `imparfait_vs_pc` — Imparfait vs Passé composé
**L'imparfait et le passé composé**
The imparfait describes ongoing background states and habitual past actions. The passé composé marks specific, completed events. The two tenses work as a pair in narrative: imparfait sets the scene, passé composé advances the story.
```
imparfait (contexte)  +  passé composé (événement)
```

### `futur_simple` — Futur simple
**Le futur simple**
The futur simple expresses future actions or predictions. It is formed by adding -ai, -as, -a, -ons, -ez, -ont to the infinitive, or to an irregular stem.
```
infinitif / radical irrégulier  +  -ai / -as / -a / -ons / -ez / -ont
```

### `conditionnel_present` — Conditionnel présent
**Le conditionnel présent**
The conditionnel présent is used for polite requests, hypothetical situations, and reported speech. It is built from the futur simple stem plus the imparfait endings.
```
radical (futur)  +  -ais / -ais / -ait / -ions / -iez / -aient
```

### `subjonctif_present` — Subjonctif présent
**Le subjonctif présent**
The subjunctive expresses doubt, emotion, necessity, or subjectivity. It is required after trigger phrases like il faut que, vouloir que, bien que, pour que.
```
déclencheur + que  +  sujet  +  subjonctif
```

### `pronoms_relatifs` — Relative pronouns
**Les pronoms relatifs**
Relative pronouns link clauses to a noun: qui (subject), que (object), où (place or time), dont (replacing de + noun). Dont is particularly tricky and very common.
```
antécédent  +  qui / que / où / dont  +  proposition relative
```

### `pronoms_toniques` — Stressed pronouns
**Les pronoms toniques**
Stressed (disjunctive) pronouns are used after prepositions, in comparisons, and for emphasis. Forms: moi, toi, lui, elle, nous, vous, eux, elles.
```
préposition / c'est  +  moi / toi / lui / elle / nous / vous / eux / elles
```

### `y_et_en` — Pronouns y and en
**Les pronoms y et en**
Y replaces à + place or à + thing. En replaces de + noun or expresses a quantity. Both precede the verb and the auxiliary in compound tenses.
```
sujet  +  y / en  +  verbe (+ complément de quantité)
```

### `double_pronoms` — Double object pronouns
**Les doubles pronoms**
When two object pronouns appear together before the verb, their order is fixed: me/te/nous/vous precede le/la/les; lui/leur follow le/la/les.
```
me/te/nous/vous  +  le/la/les  →  le/la/les  +  lui/leur
```

### `superlatif` — Superlative
**Le superlatif**
The superlative expresses the highest or lowest degree. Use le/la/les plus or le/la/les moins + adjective or adverb. Irregular forms: le meilleur, le mieux, le pire.
```
le / la / les  +  plus / moins  +  adjectif / adverbe
```

### `negation_etendue` — Extended negation
**La négation étendue**
Beyond ne…pas, French has: ne…plus (no longer), ne…jamais (never), ne…rien (nothing), ne…personne (nobody), ne…que (only). The second element placement varies by word.
```
ne  +  verbe  +  plus / jamais / rien / personne / que + nom
```

### `pronoms_interrogatifs` — Interrogative pronouns
**Les pronoms interrogatifs**
Interrogative pronouns ask about people or things and change form based on their function: qui (who), que/quoi (what), lequel/laquelle/lesquels/lesquelles (which one).
```
qui / que / quoi / lequel  +  est-ce que / inversion
```

### `depuis_pendant` — Depuis / pendant / il y a
**Depuis, pendant et il y a**
Depuis + present = ongoing duration (still happening). Pendant + passé composé = completed duration. Il y a + passé composé = elapsed time since an event ended.
```
depuis + présent  /  pendant + passé composé  /  il y a + passé composé
```

### `faire_causatif` — Causative faire
**Le faire causatif**
Faire + infinitive means to have something done or to make someone do something. The agent (the person who carries out the action) is introduced by par or à.
```
sujet  +  faire  +  infinitif  +  (par / à + agent)
```

### `gerondif` — Gérondif
**Le gérondif**
The gérondif (en + present participle) expresses a simultaneous action, the manner of doing something, or a condition. The subject of both clauses must be the same person.
```
en  +  radical (nous-form)  +  -ant
```

### `si_clauses_type1` — Si clauses (type 1)
**Les phrases conditionnelles (type 1)**
Type 1 conditionals express a real or likely condition and its probable result. The si clause takes the present tense; the main clause takes the future or imperative.
```
si  +  présent  →  futur simple / impératif
```

---

## B2 — Upper Intermediate (14 concepts)

### `subjonctif_etendu` — Extended subjunctive
**Le subjonctif étendu**
Beyond il faut que, the subjunctive is required after verbs of doubt (douter que, ne pas croire que), emotion (regretter que, être surpris que), and concessive conjunctions (bien que, quoique, à moins que).
```
douter que / bien que / regretter que  +  sujet  +  subjonctif
```

### `plus_que_parfait` — Plus-que-parfait
**Le plus-que-parfait**
The plus-que-parfait describes an action completed before another action in the past. Formed with avoir or être in the imparfait + past participle.
```
sujet  +  avoir / être (imparfait)  +  participe passé
```

### `futur_anterieur` — Future perfect
**Le futur antérieur**
The futur antérieur expresses an action completed before another future event. Formed with avoir or être in the futur simple + past participle.
```
sujet  +  avoir / être (futur)  +  participe passé
```

### `conditionnel_passe` — Conditionnel passé
**Le conditionnel passé**
The conditionnel passé expresses what would have happened in an unrealized past scenario. Used in the main clause of type-3 conditionals: si + plus-que-parfait → conditionnel passé.
```
si + plus-que-parfait  →  avoir / être (conditionnel)  +  participe passé
```

### `voix_passive` — Passive voice
**La voix passive**
The passive voice moves the object into subject position. Formed with être + past participle (agreeing with the subject). The agent is introduced by par.
```
sujet  +  être  +  participe passé (accordé)  +  par + agent
```

### `si_clauses_2_3` — Si clauses types 2 & 3
**Les phrases conditionnelles types 2 et 3**
Type 2: si + imparfait → conditionnel présent (hypothetical). Type 3: si + plus-que-parfait → conditionnel passé (unfulfilled past). Never use a conditional in the si clause.
```
si + imparfait → conditionnel présent  /  si + PQP → conditionnel passé
```

### `discours_indirect` — Indirect speech
**Le discours indirect**
Indirect speech reports what was said without quotes. Tenses shift back: présent → imparfait, passé composé → plus-que-parfait, futur → conditionnel. Pronouns and time expressions also shift.
```
il a dit que / elle a demandé si  +  sujet  +  verbe (temps décalé)
```

### `nominalisation` — Nominalisation
**La nominalisation**
Nominalisation converts a verb or adjective into a noun using suffixes like -tion, -ment, -age, -ité. Common in formal and written French to create concise abstract statements.
```
verbe / adjectif  +  suffixe (-tion / -ment / -age / -ité)  →  nom abstrait
```

### `pronoms_relatifs_cx` — Complex relative pronouns
**Les pronoms relatifs complexes**
Lequel/laquelle/lesquels/lesquelles replace a noun after a preposition (other than à/de with a person). They contract with à (auquel) and de (duquel). Ce qui/ce que/ce dont refer to a whole clause.
```
préposition  +  lequel / laquelle / lesquel(le)s  /  ce qui / ce que / ce dont
```

### `concessifs_opposition` — Concession and opposition
**Les concessifs et l'opposition**
Concessive connectors introduce a contrast: bien que / quoique (+ subjunctive), même si (+ indicative), cependant, néanmoins, pourtant, en revanche (+ indicative).
```
bien que / quoique + subjonctif  /  même si + indicatif  /  cependant / pourtant
```

### `cause_consequence` — Cause and consequence
**La cause et la conséquence**
Cause connectors: parce que, puisque, car, à cause de, grâce à. Consequence connectors: donc, alors, c'est pourquoi, si bien que, tellement…que.
```
parce que / puisque / car  +  cause  →  donc / c'est pourquoi + conséquence
```

### `constructions_inf` — Infinitive constructions
**Les constructions infinitives**
When the subject of two clauses is the same, French replaces the subjunctive with an infinitive: vouloir faire rather than vouloir que je fasse. Key prepositions: pour, avant de, sans, afin de + infinitive.
```
pour / avant de / sans / afin de  +  infinitif (même sujet)
```

### `struct_emphatiques` — Emphatic structures
**Les structures emphatiques**
Emphatic structures highlight a particular element: c'est…qui (subject) and c'est…que (object/adverb). Left/right dislocation (Le livre, je l'ai lu) is also common in spoken French.
```
c'est + élément + qui / que  /  dislocation : nom + pronom de reprise
```

### `registre_langue` — Language register
**Le registre de langue**
French distinguishes three registers: familier (t'as vu ?), courant (tu as vu ?), and soutenu (avez-vous vu ?). Grammar, vocabulary, and style all shift between registers.
```
registre familier (oral)  /  registre courant (neutre)  /  registre soutenu (écrit)
```

---

## C1 — Advanced (12 concepts)

### `subjonctif_passe` — Subjonctif passé
**Le subjonctif passé**
The subjonctif passé expresses a completed action in a subjunctive context. Formed with the subjunctive of avoir or être + past participle. Used when the subordinate action is completed before the main clause.
```
déclencheur + que  +  avoir / être (subjonctif)  +  participe passé
```

### `subjonctif_imparfait` — Subjonctif imparfait
**Le subjonctif imparfait**
A literary tense used in formal writing for sequence-of-tenses when the main clause is past. Formed from the passé simple stem + -sse, -sses, -ît, -ssions, -ssiez, -ssent.
```
radical (passé simple)  +  -sse / -sses / -ît / -ssions / -ssiez / -ssent
```

### `passe_simple` — Passé simple
**Le passé simple**
The passé simple is the literary equivalent of the passé composé, used in formal written French (novels, history). -er verbs: -ai, -as, -a, -âmes, -âtes, -èrent. Irregular stems must be memorised.
```
radical (irrégulier / -er)  +  -ai / -as / -a / -âmes / -âtes / -èrent
```

### `passe_anterieur` — Passé antérieur
**Le passé antérieur**
A literary tense expressing an action completed immediately before a passé simple action. Formed with avoir or être in the passé simple + past participle. Used after quand, dès que, aussitôt que.
```
avoir / être (passé simple)  +  participe passé
```

### `conditionnel_journalistique` — Journalistic conditional
**Le conditionnel journalistique**
The journalistic conditional reports unverified information without the speaker endorsing it — equivalent to "reportedly" or "allegedly". Used in news and formal writing.
```
conditionnel présent / passé  →  allégation non vérifiée (= "reportedly")
```

### `negation_nuancee` — Nuanced negation
**La négation nuancée**
Advanced negation: ne…guère (hardly), ne…point (not at all – literary), ne…nullement, ne…aucunement. The bare ne (without pas) appears with savoir, pouvoir, oser, cesser in formal use.
```
ne  +  verbe  +  guère / point / nullement / aucunement
```

### `nominalisation_abstraite` — Abstract nominalisation
**La nominalisation abstraite**
Advanced nominalisation uses suffixes like -isation, -ification, -ité, -isme to produce complex abstract nouns from verbal or adjectival bases. Essential for formal academic and journalistic writing.
```
base verbale / adjectivale  +  -isation / -ité / -isme  →  nom abstrait (soutenu)
```

### `connecteurs_discursifs` — Discourse connectors
**Les connecteurs discursifs**
Discourse connectors structure argument and narrative: addition (de plus, en outre), opposition (or, en revanche), illustration (notamment), conclusion (ainsi, en définitive, c'est pourquoi).
```
de plus / or / ainsi / en revanche / notamment  +  proposition (registre soutenu)
```

### `participes_implicites` — Participial clauses
**Les propositions participiales**
A participial clause uses a present or past participle to imply cause, time, or manner without a conjunction. The participle must share its subject with the main clause. Common in formal writing.
```
participe présent / passé  (sujet implicite commun)  →  proposition principale
```

### `passif_complexe` — Complex passive
**Le passif complexe**
Beyond être + participle, French uses se faire + infinitive (have something done to you), se voir + infinitive, and se laisser + infinitive for nuanced passive constructions.
```
se faire / se voir / se laisser  +  infinitif  (+ par + agent)
```

### `inversion_stylistique` — Stylistic inversion
**L'inversion stylistique**
Stylistic inversion places the verb before the subject for formal or literary effect, especially after ainsi, peut-être, aussi, sans doute, and à peine at the start of a clause.
```
ainsi / peut-être / à peine  +  verbe  +  sujet (inversion)
```

### `constructions_idiomatiques` — Idiomatic constructions
**Les constructions idiomatiques**
Advanced idioms: avoir beau + infinitive (to do in vain), ne faire que + infinitive (to do nothing but), il ne tient qu'à + infinitive (it is up to someone to), quitte à + infinitive (even if it means).
```
avoir beau + inf.  /  ne faire que + inf.  /  quitte à + inf.
```

---

## C2 — Mastery (8 concepts)

### `temps_litteraires` — Literary tenses
**Les temps littéraires**
Literary tenses (passé simple, passé antérieur, subjonctif imparfait, subjonctif plus-que-parfait) are reserved for formal written French. Mastery requires both recognition and active production.
```
passé simple / passé antérieur  /  subjonctif imparfait / plus-que-parfait (littéraire)
```

### `structures_rhetoriques` — Rhetorical structures
**Les structures rhétoriques**
Rhetorical structures shape argument: the thèse–antithèse–synthèse plan, anaphora (repetition for effect), chiasmus, and hendiadys. Essential for formal essay writing (dissertation).
```
anaphore / chiasme  /  thèse – antithèse – synthèse
```

### `precision_lexicale` — Lexical precision
**La précision lexicale**
Lexical precision means choosing the most exact word: distinguishing near-synonyms (aimer/apprécier/adorer), avoiding false friends (actuellement ≠ actually), and using collocations correctly.
```
synonyme exact  +  collocation correcte  /  éviter faux amis et approximations
```

### `variations_regionales` — Regional variations
**Les variations régionales**
French varies across regions: Québécois (septante, nonante system, tu as → t'as), Belgian French (septante, nonante), Swiss French, and African francophone varieties have distinct vocabulary.
```
français hexagonal  /  québécois / belge / suisse / africain
```

### `vocab_archaique` — Archaic vocabulary
**Le vocabulaire archaïque**
Archaic and legal vocabulary appears in classical literature and formal texts: icelle, icelui, nonobstant, susmentionné, ladite. Recognition is essential for reading historical and legal documents.
```
vocabulaire juridique / classique  →  reconnaissance en contexte littéraire ou légal
```

### `registre_stylistique` — Stylistic register
**Le registre stylistique**
At C2, stylistic mastery means adapting vocabulary, syntax, and tone across registers — from literary prose to academic argument to professional correspondence — with conscious control of effect.
```
registre littéraire / académique / professionnel  →  adaptation consciente
```

### `ellipse_syntaxique` — Syntactic ellipsis
**L'ellipse syntaxique**
Syntactic ellipsis omits predictable elements for concision or style: "Il part, elle aussi." Common in formal writing, poetry, and aphorisms.
```
élément omis (récupérable par contexte)  →  effet de concision ou de style
```

### `ironie_implicature` — Irony and implicature
**L'ironie et l'implicature**
Irony says the opposite of what is meant; implicature conveys meaning beyond the literal words (Gricean maxims). Decoding requires context, intonation, and cultural knowledge.
```
sens littéral ≠ sens voulu  →  décodage par contexte / implicature (Grice)
```

---

## Summary

| Level | Count | Focus |
|-------|-------|-------|
| A1 | 14 | Core pronouns, verb groups, articles, basic negation and questions |
| A2 | 15 | Past tenses, object pronouns, adjective and article nuances |
| B1 | 15 | Narrative tense contrast, subjunctive, pronoun stacking, si clauses |
| B2 | 14 | Literary compound tenses, passive, indirect speech, discourse connectors |
| C1 | 12 | Literary tenses, stylistic register, complex passives, idiomatic structures |
| C2 | 8  | Rhetoric, lexical precision, regional variation, implicature |
| **Total** | **78** | |
