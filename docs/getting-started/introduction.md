---
description: An introduction to what d9 is, how it works, who it is for, and when to use it.
readTime: 8 min read
---

# Introduction

> These Docs will help you get d9 up-and-running quickly, guide you through advanced features, and explain the
> core concepts that make d9 so unique.

## About d9

**d9** is an open-source fork of Directus 9 (GPLv3), maintained independently by [La Webcapsule](https://github.com/LaWebcapsule). While Directus 10+ moved to a premium licensing model, d9 preserves a fully open-source data platform with a focus on **performance** and **European regulatory compliance**.

d9 is not affiliated with the Directus core team. It is a community-driven project that ensures long-term open-source availability of the Directus 9 codebase.

::: info Etymology

The name "d9" comes from **D**irectus **9**. The word _Directus_ ([duh REKT iss](http://audio.pronouncekiwi.com/Salli/Directus)) is Latin for: _laid straight, arranged in lines_. The broadest goal of our platform is to present data in a simple, orderly, and intuitive way.

:::

## What is d9?

<!--
@TODO
getting-started > introduction
Add 2-4 min Promo Video When Ready
-->

**d9 is an Open Data Platform built to democratize the database.**\
This platform provides everyone on your team, _regardless of technical skill_, equal access to data and digital file asset
management, for any data model or project. First, link d9 to your desired SQL database and file storage adapter. After
that, d9 enables you to perform CRUD operations, create users, assign roles with fully configurable permissions, build
complex and granular queries, configure event-driven webhooks and task automation... _the list goes on!_

**Database Introspection & Abstraction**\
SQL flavors all come with slightly different data types and idiosyncrasies. d9 uses [Database Introspection](#how-it-works)
to read your database structure and create an abstraction layer to handle all the nitty-gritty details behind the scenes.
This technique works seamlessly with any major SQL database. It also lets you link d9 to your new or pre-existing database
or remove it anytime, with no impact on your existing data model. That means you'll never encounter vendor lock-in.

**The App and APIs**\
Once your database is introspected and abstracted, d9 dynamically generates REST and GraphQL API endpoints to manage
your data with granular control. You also get CLI tools for file management and a complete JavaScript SDK.

The API and CLI power the no-code App. In other words, the App is just a GUI that provides no-code access to the API.
This architecture is how d9 democratizes the database and provides control to [the whole team](#who-s-it-for).

**Open-Source, Modular, Extensible, Scalable**\
At the highest level, d9 organizes its features and functionality into Modules. Each Module allows you to interact
with data in some specific way, such as data and content management, digital file asset management, drag and drop analytics
dashboard creation, or whatever. If you find d9 is missing something that your project needs, no problem!

Built entirely in Typescript, primarily on [Node.js](https://nodejs.dev) and [Vue.js](https://vuejs.org), d9 is
100% open-source, modular and extensible, ensuring your project never hits a hard feature ceiling. The platform scales
without issue, _and some Projects have hundreds of millions of users._

You can use it with any _(or many)_ stacks or frontend frameworks.

**Custom Configuration Options**\
Extensive configuration options are also available as global variables in the codebase. Developers can custom configure SSO
authentication method, caching details, default file storage location (local, S3, google, etc.) for digital assets, emails,
_and much more._

:::tip Ready to dive in?

Get a project running in minutes. Learn d9 hands-on in the [Quickstart Guide](/getting-started/quickstart).

:::

## How It Works

**d9 is installed as a _layer_ on top of your new or existing SQL database.**

The App and API dynamically _"mirror"_ your actual schema and content in real-time. This is similar to how technical
database clients (like _phpMyAdmin_) work. However, Database Introspection has many unique advantages:

- Absolute control over your pure SQL database schema.
- Complete transparency, portability, and security for your data.
- Allows importing existing databases, unaltered and without migrations.
- Direct database access and the full power of raw, complex SQL queries.
- Significant performance improvements through optimizations and indexing.

In contrast, other platforms typically use a predefined or proprietary _one-size-fits-all_ data model to store content .
That is not the case with d9. d9 gives you direct access to your pure and unaltered data. That means you
have the option to bypass the d9 middleware (API, SDK, App) and connect to your data with proper SQL queries. This
effectively removes all bottlenecks, latency overhead, and proprietary access limitations.

<!--
:::tip Ready to try the API?

Get a Project running in minutes. Test the API hands-on in the [Quickstart Guide](/getting-started/quickstart).

:::
-->

## Who's It For?

**d9 lets the whole team work together and access data in one place.**

**Developers**\
Developers get a complete data connection toolkit with REST and GraphQL APIs, a JavaScript SDK, access to global variables
to customize configuration options, and direct command-line access to digital assets.

**Power Users**\
Data analysts and data scientists have in-app tools to query data, build out in-app analytics dashboards, and extract or
upload data in file format. Additionally, these users are still free to link other services and run raw SQL queries directly
on the database.

**Business Users**\
The no-code app is safe and intuitive enough to make data accessible to everyone, even the most non-technical users. Administrators
can create fully granular permissions for roles as well as individual users.

:::tip d9 Vocabulary

To keep things simpler, _especially for the no-code users_, d9 uses friendlier names for many database terms and
technical concepts, including [Project](/getting-started/glossary#projects) (database),
[Collection](/getting-started/glossary#collections) (table), [Field](/getting-started/glossary#fields) (column),
[Item](/getting-started/glossary#items) (record), and [Type](/getting-started/glossary#types) (datatype).

<!--
@TODO getting-started > learn-directus
For more information on d9-specific terms, see the guide on [how to learn d9](/getting-started/learn-directus).
-->

:::

<!--
:::tip Ready to see what d9 can do?

Checkout the core features and learn d9 hands-on in the [Quickstart Guide](/getting-started/quickstart).

@TODO getting-started > crashcourse
Change this CTA to the 20-30 min crashcourse

:::
-->

## When to Use It

**d9 can power any data-driven project and can be linked or removed at any time.**

Build, monitor or manage any data model or app you desire: IoT fleets, e-commerce, SaaS, business data analytics,
multi-channel content, _or anything else!_ If it involves SQL and digital files, you can link up d9. With this in
mind, four broad use cases do emerge:

**Backend as a Service**\
An end-to-end data solution. Efficiently connects data, auto-generates exhaustive APIs for projects that scale, and provides
webhooks and task automation. Completely detached from the database, you're free to link and remove d9 anytime or use
any other service in tandem.

**Headless CMS**\
Remember, _content_ is just data from a database! Manage any omnichannel digital experience. Deliver file assets and data
across websites, apps, kiosks, digital signage... _the sky's the limit!_

**Internal Tool Builder**\
The whole team can build custom apps! Ditch the spreadsheet and quickly build back-office apps and admin panels for customers,
inventory, projects, marketing, _or anything else._

**Data Management and Analytics**\
Establish _a single source of truth_ for all data. Build no-code analytics dashboards to gain insights into company KPIs
and other metrics. Coalesce previously siloed department data.

<!--
:::tip Ready to dive-in?

Get a Project running in minutes. Learn d9 hands-on in the [Quickstart Guide](/getting-started/quickstart).

:::
-->

## Why Use It?

**d9 is a simple, data-first solution to complex problems with no downsides.**

d9 was created in 2004 and has been slowly, iteratively improved on for a long time. The core team has carefully
thought through the app, beginning to end, and strives to make this platform is an all-benefit and no downside
experience. It is also plug-and-play, so you're free to link or remove it anytime, with zero impact on your data. You
have no vendor lock-in whatsoever, _your data is yours_. There are no artificial data limits _(e.g. limits on users or
roles)_.

Consider competing platforms in the four general use cases [mentioned above](#when-to-use-it). Due diligence to select a
viable solution from one of these categories can easily take six months to ensure the feature list, pricing,
scalability, migration options, etc.. all match the project in question. However, with d9, that's not the case!
You can test it immediately on an existing database or build a new data model from scratch, _with no impact on your data
and no long-term commitments._

The following core principles guide this platform:

- **Pure** — No predefined or proprietary schema. All system metadata is stored separately.
- **Open** — d9 Core is open source, with no obfuscated or cloud-only code.
- **Portable** — No vendor lock-in. Your database can be exported or migrated anytime.
- **Limitless** — No arbitrary limits or paywalls on users, roles, translations, and data.
- **Extensible** — Every aspect of this platform is modular to avoid any hard feature ceiling.
- **Unopinionated** — Choose the stack, database, and architecture as you wish.

## Self-Hosted

**d9 is designed to be self-hosted on your own infrastructure.**

You have full control over your data, your deployment, and your infrastructure. Run d9 with Docker, on bare metal, or on any cloud provider of your choice.

:::tip Ready to get started?

Deploy your own d9 instance in minutes with the [Quickstart Guide](/getting-started/quickstart) or the [Docker Guide](/self-hosted/docker-guide).

:::
