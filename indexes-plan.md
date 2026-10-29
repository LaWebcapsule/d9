# Plan — Gestion des index dans d9

Document de travail. Synthèse des décisions prises en amont et découpage d'implémentation.

## 1. Périmètre

**Objectif v1** : depuis l'interface d'administration, lister les index d'une collection, en créer, en supprimer, et éditer ceux qui sont éditables.

**Options exposées en v1**

| Option | Supporté |
|---|---|
| `columns` (liste ordonnée, ≥ 1) | partout sauf Redshift |
| `where` (filtre Directus → prédicat partiel) | Postgres, SQLite, SQL Server, CockroachDB |
| `unique` | **non** — différé (v2) |
| `type` (btree/hash/gin/…) | **non** — btree implicite uniquement |
| `include`, `lengths`, `concurrent`, `invisible`, `desc`, `nullsNotDistinct` | **non** — différé |

**Contraintes de conception**

- Admin uniquement, comme les mutations de collections/fields. Pas de `directus_indexes`, pas de bootstrap de permissions.
- La base est la source de vérité pour l'**existence** des index.
- Pas d'intégration au snapshot/diff en v1.
- Aucune écriture hors du sous-système index, sauf le JSON de round-trip du filtre (voir D2).

## 2. Décisions

**D1 — Pas d'unique en v1.**
Sur Postgres, `UNIQUE` a deux matérialisations (contrainte ou index) avec deux chemins de suppression, et l'inspecteur ne voit que les contraintes. Les uniques existants sont listés en lecture seule avec un lien vers le réglage qui les possède (toggle `is_unique` du champ). v2 tranchera la matérialisation, le jour où on veut les uniques composites.

**D2 — Round-trip du filtre partiel via `directus_collections.indexes_meta` (JSON).**
La base ne stocke que le SQL compilé (`WHERE status = 'published'`), pas le filtre Directus qui l'a produit. Sans persistance, on ne peut pas réafficher le filtre dans l'éditeur. On ajoute une colonne `json` nullable `indexes_meta` sur `directus_collections` (précédent : `check_filter`, migration `20251204A`), de la forme :

```json
{ "articles_slug_where_idx": { "where": { "_and": [{ "status": { "_eq": "published" } }] } } }
```

Usage : **préremplissage seulement**. Si l'index n'existe plus en base, l'entrée est ignorée (pas de nettoyage automatique en v1). La colonne n'est pas chargée dans `SchemaOverview` : le service la lit directement, donc pas de couplage au cache de schéma.

*Alternative si on veut zéro persistance* : les index partiels deviennent non éditables (`where` en lecture seule, recréation obligatoire). À trancher avant la phase 4.

**D3 — Nom.**
Généré par défaut via `getDefaultIndexName('index', collection, columns)` (cap 60 + hash). Nom custom accepté à la création (validation : `^[a-z][a-z0-9_]*$`, ≤ 60). **Lecture seule en édition** : renommer = drop + create, non portable.

**D4 — Édition = drop + create, en un seul `PATCH`.**
Le nom étant identique, il n'y a pas d'autre ordre possible. Une seule requête serveur, donc une seule fenêtre d'échec, et un message clair si le create échoue. Le front ne fait jamais DELETE puis POST.

**D5 — Règle de round-trip.**
Un index est `editable` si et seulement si on sait régénérer un DDL équivalent à partir de ce qu'on expose. Donc `editable: false` si : `kind !== 'index'`, expression, `INCLUDE`, méthode d'accès ≠ btree, index invalide (`indisvalid = false`), ou nom non conforme.

**D6 — Capacités côté serveur, formulaire côté client.**
`SchemaHelper.indexCapabilities` est la vérité (validation + payload). Le front reçoit `meta.capabilities` et en déduit les champs visibles. Pas de matrice dans `app/`. `vendor` n'est pas ajouté à `/server/info` en v1.

**D7 — Pas de store Pinia.**
Les index sont locaux à une page. Un composable `useIndexes(collection)` suffit ; `refresh()` après mutation.

**D8 — Pas de versionnage du payload de capacités.**
Front et back sont livrés ensemble (le front est servi par le back). On tolère quand même les clés inconnues côté client.

## 3. Architecture

| Couche | Rôle | Emplacement |
|---|---|---|
| Introspection | lire les index du catalogue | `packages/schema/src/dialects/*`, `types/index.ts` |
| DDL | créer/supprimer par dialecte | `api/src/database/helpers/schema/types.ts` + dialectes |
| Capacités | support par client | `api/src/database/helpers/schema/capabilities.ts` |
| Compilation filtre | filtre Directus → SQL | `api/src/utils/check-constraints.ts` (extraction) |
| Service | validation, nommage, orchestration | `api/src/services/indexes.ts` |
| API | 4 routes admin | `api/src/controllers/indexes.ts`, montage dans `app.ts` |
| Types | DTO partagés | `packages/types/src/indexes.ts` (ou `schema.ts`) |
| UI | liste + drawer | `app/src/modules/settings/routes/data-model/indexes/*` |
| État | fetch/mutations | `app/src/composables/use-indexes.ts` |
| Spec | OpenAPI | `packages/specs/src/paths/indexes/*` |

## 4. Contrats d'API

### `GET /indexes/:collection`

```json
{
  "data": [
    {
      "name": "articles_slug_where_idx",
      "columns": ["slug", "locale"],
      "unique": false,
      "kind": "index",
      "predicate": "((status)::text = 'published'::text)",
      "where": { "_and": [{ "status": { "_eq": "published" } }] },
      "editable": true,
      "readonly_reason": null
    },
    {
      "name": "articles_pkey",
      "columns": ["id"],
      "unique": true,
      "kind": "primary",
      "predicate": null,
      "where": null,
      "editable": false,
      "readonly_reason": "primary_key"
    }
  ],
  "meta": {
    "capabilities": {
      "vendor": "postgres",
      "options": {
        "columns": { "supported": true },
        "where": { "supported": true }
      }
    }
  }
}
```

`readonly_reason` ∈ `primary_key` | `unique_constraint` | `expression` | `include` | `non_btree` | `invalid` | `foreign_key` | `not_managed`.
`kind` ∈ `index` | `primary` | `unique_constraint` | `unique_index` | `foreign_key_index` | `expression` | `unsupported`.

### `POST /indexes/:collection`

```json
{ "name": "articles_slug_where_idx", "columns": ["slug", "locale"], "where": { "_and": [] } }
```

- `name` optionnel (généré sinon).
- 400 si : collection inconnue, colonne inconnue, colonne `alias`, `columns` vide, doublon de nom, `where` non supporté par le client, filtre invalide ou non compilable.
- 201 + l'objet créé.

### `PATCH /indexes/:collection/:name`

Même payload, `name` interdit. 400 si l'index n'est pas `editable`. Effet : drop + create.

### `DELETE /indexes/:collection/:name`

204. 400 si l'index n'est pas `editable` (on ne supprime pas une contrainte ou un index d'expression depuis ce panneau).

Chaque mutation appelle `clearSystemCache({ autoPurgeCache })` (invalidation du cache de réponse HTTP) et émet `indexes.create` / `indexes.update` / `indexes.delete`.

## 5. Phases

### Phase 1 — Introspection (`@wbce-d9/schema`)

- Type `Index` dans `packages/schema/src/types/index.ts`.
- Méthode `indexes(table?: string): Promise<Index[]>` sur l'interface + implémentations.
- Postgres (et CockroachDB si le catalogue est compatible) : `pg_index` + `pg_class` + `pg_constraint` (LEFT JOIN sur `conindid`, `contype IN ('p','u')`), `indisvalid`, `indnkeyatts` vs `indnatts` (INCLUDE), `pg_get_indexdef(indexrelid, n, true)` pour les colonnes et les expressions.
- MySQL/MariaDB : `information_schema.statistics` (`NON_UNIQUE`, `SEQ_IN_INDEX`, `COLUMN_NAME`, `SUB_PART`, `EXPRESSION`, `INDEX_TYPE`), classification des contraintes via `information_schema.table_constraints`.
- SQLite : `PRAGMA index_list` + `PRAGMA index_info` + `sqlite_master.sql` (pour détecter partiel et expression ; `sqlite_autoindex_*` → non éditable).
- MSSQL : `sys.indexes`, `sys.index_columns`, `sys.columns`, `sys.check_constraints` non concerné. Filtrer heaps (type 0), `is_hypothetical`.
- Oracle et Redshift : Redshift renvoie `[]` ; Oracle en phase ultérieure.
- **Acceptance** : sur une table de test contenant PK, contrainte unique, unique index, index composite, partiel, expression, INCLUDE — le `kind`, l'ordre des colonnes et le `predicate` sont corrects ; aucun crash.

### Phase 2 — DDL et capacités

- `SchemaHelper.createIndex(table, { name, columns, where? })` et `dropIndex(table, name)`.
- `INDEX_CAPABILITIES: Record<DatabaseClient, ...>` + accesseur `getIndexCapabilities(knex)`.
- Validation/normalisation du nom (utilitaire, réutilise `getDefaultIndexName`).
- **Acceptance** : create/drop sur PG, MySQL, MariaDB, SQLite, MSSQL ; `where` refusé en 400 sur MySQL/MariaDB ; Redshift → 400 « indexes not supported ».

### Phase 3 — Service + API (lecture, création, suppression)

- `IndexesService` : `readAll`, `createOne`, `deleteOne`, admin-only, sans transaction (une instruction DDL).
- Contrôleur + montage `app.ts` (`/indexes`).
- Types DTO, specs OpenAPI, clés i18n d'erreur.
- **Acceptance** : blackbox par vendor ; la liste reflète le catalogue après create/delete ; les index non éditables sont refusés en suppression.

### Phase 4 — Filtre partiel

- Extraire `renderFilterAsSql(knex, schema, collection, filter)` de `formulateCheckClause` ; `check_filter` et index partiels l'utilisent.
- Restreindre aux colonnes de la collection (pas de relation, pas de sous-requête).
- Refuser côté service si le client ne supporte pas `where`.
- Traduire les erreurs Postgres d'immutabilité en message utilisateur.
- Persistance `indexes_meta` (D2) : migration + lecture/préremplissage + écriture à la création.
- **Acceptance** : création d'un index partiel, `\d` le confirme, une ligne violant le prédicat est refusée ; réouverture du drawer préremplit le filtre ; un index partiel créé hors d9 est listé non éditable (pas de `where` stocké).

### Phase 5 — UI

- Route `data-model/:collection/indexes` (+ `indexes/:name`), déclarée **avant** `:field`.
- `indexes.vue` : tableau `v-table` (name, composite, unique, partial, kind) + état vide + bouton créer.
- `index-detail.vue` : `v-drawer` avec 3 modes (create/edit/read-only) et 2 onglets.
- Onglet « Champs » : `draggable` des colonnes sélectionnées + sélecteur filtré (`type !== 'alias'`, `!schema.is_primary_key`).
- Onglet « Partial » : `interface-system-filter` avec `collection-name`, `include-relations=false`, `relational-field-selectable=false`, `allow-field-comparison`, masqué si `!capabilities.where`.
- `use-indexes.ts` : fetch + create + update + delete + `refresh()`.
- i18n (`en-US.yaml`, `fr-FR.yaml`), specs.
- **Acceptance** : parcours complet sur PG ; sur MySQL l'onglet partial n'apparaît pas ; un index non éditable ouvre le drawer en lecture seule avec la raison et l'action « dupliquer ».

### Phase 6 — Différé

Snapshot/diff (`indexes[]` dans `Snapshot`, `applyDiff`), uniques composites, options avancées, `CONCURRENTLY`, renommage, Oracle, réconciliation des `indexes_meta` orphelins.

## 6. Tests

- **Unitaires** : nommage, validation du payload, compilation du filtre, classification `kind`/`editable`.
- **Blackbox** `tests/blackbox/routes/indexes/crud.test.ts` : `it.each(vendors)`, skip explicite pour Redshift et pour `where` hors vendors supportés.
- **Contrairement aux tests `check_filter` existants** (qui n'assertent que l'écho HTTP), asserter l'état réel du catalogue après mutation, et pour un index partiel PG, insérer une ligne violant le prédicat et vérifier le rejet.
- **Manuel** : index partiel sur une table avec données, puis `EXPLAIN` pour vérifier qu'il est utilisable.

## 7. Risques

| Risque | Mitigation |
|---|---|
| Prédicat non immutable (PG) | liste blanche d'opérateurs, pas de relation, erreur traduite |
| Restrictions des filtered indexes MSSQL | validation côté serveur, messages explicites, tests dédiés |
| `PATCH` non atomique (index absent entre drop et create) | une seule requête, ordre explicite, message clair |
| Verrouillage sur grosse table | `CONCURRENTLY` hors périmètre v1 ; avertissement UI |
| Cache de réponse HTTP périmé | `clearSystemCache` après chaque mutation |
| Nom en collision (PG : par schéma) | validation d'unicité avant DDL |
| `indexes_meta` orphelin / désynchronisé | traité comme un simple préremplissage, jamais comme une source de vérité |
| Index créés hors d9 | `editable: false` dès qu'on ne peut pas reproduire le DDL |

## 8. Hors périmètre explicite

Snapshot, uniques, types d'index, INCLUDE, longueurs de préfixe, DESC, INVISIBLE, `NULLS NOT DISTINCT`, `CONCURRENTLY`, renommage, Oracle, Redshift, permissions granulaires, notes/libellés par index.

## 9. Mode de travail

**Tout se fait en local, sur la branche courante. Aucun commit, aucune PR.** Les phases sont livrées d'un bloc, puis testées manuellement en local.

La PR #435 (« Indexed » checkbox, `Column.is_indexed`) est traitée comme un travail **parallèle et indépendant**. On ne dépend pas d'elle et on ne modifie pas `Column` : notre modèle d'index est index-level, pas column-level. Si elle est mergée plus tard, la compatibilité tient parce que les noms générés sont les mêmes (`<table>_<colonne>_index`).

Points de vigilance repris de #435 :

- l'index créé par le checkbox apparaîtra dans notre liste comme un index normal, éditable ;
- le supprimer depuis notre panneau fera repasser `is_indexed` à `false` côté champ (cohérent, mais à signaler dans l'UI) ;
- ne pas copier son `dropIndex` par nom calculé : on utilise toujours le nom réel issu de l'introspection.

## 10. Fichiers touchés

```
packages/schema/src/types/index.ts                    (nouveau)
packages/schema/src/types/schema-inspector.ts
packages/schema/src/index.ts
packages/schema/src/dialects/{postgres,mysql,sqlite,mssql,cockroachdb,oracledb}.ts

packages/types/src/indexes.ts                         (nouveau)
packages/types/src/index.ts

api/src/database/helpers/schema/types.ts
api/src/database/helpers/schema/capabilities.ts       (nouveau)
api/src/utils/check-constraints.ts
api/src/database/migrations/20261026A-add-collections-indexes-meta.ts (nouveau)
api/src/services/indexes.ts                           (nouveau)
api/src/controllers/indexes.ts                        (nouveau)
api/src/app.ts
api/src/services/collections.ts                       (omit indexes_meta)

app/src/composables/use-indexes.ts                    (nouveau)
app/src/modules/settings/index.ts
app/src/modules/settings/routes/data-model/indexes/indexes.vue        (nouveau)
app/src/modules/settings/routes/data-model/indexes/index-detail.vue   (nouveau)
app/src/lang/translations/{en-US,fr-FR}.yaml
```

## Annexe — requête Postgres

```sql
SELECT
  ic.relname                           AS name,
  ix.indisunique                       AS is_unique,
  ix.indisprimary                      AS is_primary,
  ix.indisvalid                        AS is_valid,
  am.amname                            AS access_method,
  con.contype                          AS constraint_type,
  pg_get_expr(ix.indpred, ix.indrelid) AS predicate,
  pg_get_indexdef(ix.indexrelid)       AS definition,
  ix.indnatts                          AS total_columns,
  ix.indnkeyatts                       AS key_columns,
  ARRAY(
    SELECT pg_get_indexdef(ix.indexrelid, k, true)
    FROM generate_series(1, ix.indnkeyatts) AS k
  )                                    AS columns
FROM pg_index ix
JOIN pg_class ic ON ic.oid = ix.indexrelid
JOIN pg_class tc ON tc.oid = ix.indrelid
JOIN pg_am am ON am.oid = ic.relam
LEFT JOIN pg_constraint con
  ON con.conindid = ix.indexrelid AND con.contype IN ('p', 'u')
WHERE tc.relname = ?
ORDER BY ic.relname;
```

### Convention appliquée dans `validateName`

- Nom personnalisé : doit commencer par `<table>_` et finir par `_index`, avec une partie non vide
  entre les deux (regex + longueur 60 conservées).
- Nom généré : contrôlé pour la syntaxe uniquement (les très longs noms de collection sont tronqués
  avec un hash et ne peuvent pas toujours porter le préfixe complet).
- `assertNameNotACollection` et `assertNameAvailable` supprimés : un doublon ou une collision de
  nom est désormais remonté par la base et traduit en 400 (`42P07`, `ER_DUP_KEYNAME`, « already
  exists » SQLite). La convention `<table>_…_index` rend la collision avec la table elle-même
  impossible pour un nom personnalisé.
- Tests : 9/9 (convention, doublon inter-tables traduit, doublon de nom par défaut).

### Validation : uniquement les formats non vérifiés par le moteur SQL

Principe retenu : les types TypeScript sont le contrat ; au runtime, on ne valide que ce que la
base ne vérifie pas.

- Supprimés : `validateColumns` (existence, alias, doublons, tableau vide, type des éléments),
  `typeof` sur `name` / `columns` / `where`, et le garde `typeof payload.name`.
- Conservés :
  - `requireAdmin` (sécurité) ;
  - `assertSupported` / `validateWhere` (capacité du driver pour les index partiels) ;
  - `assertCollection` (contrat d'existence, aussi couvert par le middleware de route) ;
  - `validateName` : regex, longueur 60, préfixe `<table>_`, suffixe `_index`, partie non vide ;
  - `translateIndexError` : `42P07`, `ER_DUP_KEYNAME` et les doublons SQLite → 400.
- Conséquence : une colonne inconnue, un alias, un tableau vide ou des doublons partent au DDL et
  remontent l'erreur de la base (500) ; un nom mal formé reste un 400.
