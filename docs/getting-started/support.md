---
description: How to get support for your d9 project.
readTime: 3 min read
---

# Help & Support

> If you have questions while working with d9, there are many resources to help you get up-and-running smoothly.

## Troubleshooting Steps

If you're experiencing issues or think you have found a problem in d9, be sure to follow these steps before
[Reporting a Bug](/contributing/introduction#bug-reporting):

1. Ensure your server and database meet the [minimum requirements](/self-hosted/docker-guide.html#supported-databases).
2. Ensure you're on the [latest version]({{GITHUB_URL}}/releases/latest) of d9.
3. Stop `CTRL+C` and restart the server `npx d9 start`.
4. Run the database migration script: `directus database migrate:latest`\
   _Note: backup your database first._
5. Disable any data-caching within your project.
6. Test any app issues with both browser extensions and caching disabled _(i.e. Incognito Mode)_.
7. Confirm the issue is not related to your own custom code.
8. Check for [existing Issues]({{GITHUB_URL}}/issues?q=is%3Aissue) (and
   [Discussions]({{GITHUB_URL}}/discussions)) that match your problem.

If you're still experiencing a problem after completing the above steps, you can reach out via
[community support](#community-support) or [report a bug](/contributing/introduction#bug-reporting).

## Community Support

[GitHub Discussions]({{GITHUB_URL}}/discussions) is a great first place to reach out for
help. Our community and core developers often check this platform and answer posts. It has the added benefit of being an
archival resource for others developers with similar questions.

:::warning No Guaranteed Response Time

While the d9 Core Team plays an active and engaged role in community discussions, there is no guaranteed response
time for Community Support.

:::

## Direct Support

For any question or support request, reach out at [support@webcapsule.io](mailto:{{SUPPORT_EMAIL}}).

## Frequently Asked Questions

### Does d9 support Mongo/NoSQL?

Not currently. d9 has been built specifically for wrapping _relational_ databases. While we could force Mongo to
use tables, columns, and rows via Mongoose object modeling, that approach of "faking" a relational structure in a
non-structured environment like Mongo doesn't make a lot of sense. We do realize many users are interested in this
feature, and will continue to explore its possibility.

### Why haven't you added this feature, or fixed that issue yet?

d9 is an open-source project, maintained by a small core team and community contributors who have limited time and
resources.

Our platform is feature-rich, however we strictly adhere to our
[80/20 Rule](/contributing/introduction#feature-requests) to avoid a messy/bloated codebase. d9 is also quite
stable, however new issues still arise, some of which may be triaged with a lower prioritization.

You can also [submit a pull request]({{GITHUB_URL}}/pulls) — after all, it is open-source!

### Can you give an ETA for this feature/fix?

Most likely not. This is open-source software, work is prioritized internally, and all timelines are subject to change.
