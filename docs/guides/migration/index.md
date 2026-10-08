# Migrate Your Data Model

Moving changes from a development project to a production project can be done in two ways.

The [projen template](/self-hosted/projen-d9) saves the whole database schema, along with the d9
configuration tables (roles, permissions, flows, settings...), your reference tables, Cedar policies and shared files,
then applies them to your other environments. It is the most complete way to replicate a project across environments,
but it is currently PostgreSQL only.

d9' schema migration endpoints allow users to retrieve a project's data model and apply changes to another
project. The data model covers collections, fields and relations, but not roles and permissions.

This is useful if you make changes to a data model in a development project and need to apply them to a production
project, or to move from a self-hosted project to d9 Cloud.

<Card 
  title="Schema Migration with Projen" 
  h="2"
  text="Learn how to promote your schema, roles, permissions, reference tables and files across environments. Currently PostgreSQL only." 
  url="/guides/migration/projen"
  icon="/icons/projen.svg" />

<Card 
  title="Schema Migration with Node.js" 
  h="2"
  text="Learn how to migrate your schema between d9 projects with a script." 
  url="/guides/migration/node"
  icon="/icons/node.svg" />

<Card 
  title="Schema Migration with Hoppscotch" 
  h="2"
  text="Learn how to migrate your schema between d9 projects without code." 
  url="/guides/migration/hoppscotch"
  icon="/icons/hoppscotch.svg" />
