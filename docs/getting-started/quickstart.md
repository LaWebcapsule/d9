---
description:
  Get up and running with d9 in minutes. Learn the basics of building your data model and managing
  permissions.
readTime: 7 min read
---

# Quickstart Guide

> This quickstart guide is designed to get you up and running with a d9 Project in a snap. Along the way,
> you will better understand what d9 is, get a _hands-on introduction_ to the App and API, and find more
> resources to deep-dive into.

## 1. Install & Start d9

The fastest way to get started is with Docker:

```bash
docker run -d \
  -p 8055:8055 \
  -e KEY=some-random-key \
  -e SECRET=another-random-key \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD=your-password \
  -e DB_CLIENT=sqlite3 \
  -e DB_FILENAME=/directus/database/data.db \
  ghcr.io/lawebcapsule/directus9:latest
```

Or with npm:

```bash
npm init @wbce-d9/directus-project@latest
```

Once running, open `http://localhost:8055` in your browser and log in with the admin credentials you set above.

:::tip Learn More About Self-Hosting

- [Docker Guide](/self-hosted/docker-guide)
- [Config Options](/self-hosted/config-options)

:::

## 2. Create a Collection

Once logged in, you're greeted with the option to create your first [Collection](/getting-started/glossary#collections).

1. Navigate into the Content Module.
2. Click **"Create Collection"** and a side menu will appear.
3. Fill in a **Name**.\
   For the sake of this demo, we'll call ours `articles`, but feel free to make it your own!
4. Leave the other options at default. Click <span mi btn>arrow_forward</span> and the **"Optional System Fields"** menu
   will open.\
   Keep the values in this menu at the default, toggled off, for now. You can adjust them later.
5. Click <span mi btn>check</span> in the menu header.

:::tip Learn More About Collections

- [The Content Module](/app/content)
- Create and Manage a Collection
- [Build Relationships Between Collections](/app/data-model/relationships)

:::

## 3. Create a Field

With your first Collection created, it's time to start adding some [Fields](/getting-started/glossary#fields).

1. Navigate to **Settings Module > Data Model > `Collection-Name`**.
2. Click the **"Create Field"** button and select the **"Input"** Field type.
3. Fill in a Field name under **Key**. We'll be calling our Field `title`.\
   d9 offers powerful Field customization options, but let's stick to the defaults for now.
4. Select **"Save"**.

::: tip Learn More About Fields

- [Create and Manage Fields in the App](/app/data-model)

:::

## 4. Create an Item

Now that we have a Collection with a Field configured, it's time to add an [Item](/getting-started/glossary#).

1. Navigate to the Content Module.
2. Click <span mi btn>add</span> in the page header to open the Item Page.
3. Fill in the Field Value(s) as desired.
4. Click <span mi btn>check</span> in the top-right to save your Item.

:::tip Learn More About Items

- [The Content Module](/app/content)
- [The Item Page](/app/content/items)

:::

## 5. Set Roles & Permissions

d9 comes with two built-in roles: Public and Admin. The Public Role determines what data is returned to
non-authenticated users. Public comes with all permissions turned off and can be reconfigured with fully granular
control to expose exactly what you want unauthenticated Users to see. The Admin role has full permissions and this
cannot be changed. Aside from these built-in Roles, any number of new Roles can be created, all with fully customized,
granular permissions.

By Default, content entered into d9 will be considered private. So permissions always start off set to the default
of <span mi icon dngr>block</span> **No Access**, with full ability to reconfigure as desired. So, in order to have the
API return our Items, let's add some read permissions. For simplicity's sake, we'll do this on the Public Role, instead
of creating a new Role.

1. Navigate to **Settings Module > Roles & Permissions > Public**.
2. Click <span mi icon dngr>block</span> under the <span mi icon>visibility</span> icon on the desired Collection.\
   In our case, the Collection name is `article`.
3. Click **"All Access"** to give the Public Role full read permissions to the Items in this Collection.

::: tip Learn More About Roles & Permissions

- [Users, Roles and Permissions](/app/users-roles-permissions).

:::

## 6. Connect to the API

Now that your Project has some content in it which is exposed to the Public, it's time to start using this content
externally! Data can be accessed in a number of ways, including the REST and GraphQL API endpoints. In this case, we'll
use the `/items/` [REST API endpoint](/reference/items) to retrieve the Item we just created.

1. Open `http://localhost:8055/items/articles`.\
   You can use the browser or an API tool like [Postman](http://postman.com) or [Paw](https://paw.cloud)

_And there it is! The Article Item you just created is being served in beautiful JSON, ready to be used anywhere and
everywhere!_

```json
{
	"data": [
		{
			"id": 1,
			"title": "Hello World!"
		}
	]
}
```

_In this example, we made a super-simple read request with the API, but there's more! The REST and GraphQL APIs provide
exhaustive endpoints for the data model and every single action that you can do in the App can be done via the API. In
fact, the App is just a GUI powered by the API._

:::tip Learn More About The API

- [Intro to the API](/reference/introduction)
- [JS SDK](/reference/sdk)

:::
