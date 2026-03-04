---
name: ses-eu-west3-setup
description: Configure AWS SES in eu-west-3 (Paris) for EU-based Directus projects to ensure email delivery.
tags: [infra, aws, email, config]
version: 1.0.0
license: MIT
recommended_scope: project
metadata:
  author: la-webcapsule
  source: d9-session
  sessions: 1
  confidence: 0.78
---

# Skill: SES EU-West-3 Setup

## Purpose

When configuring email delivery for a EU-based Directus/d9 project using AWS SES, you must explicitly set the AWS region to `eu-west-3` (Paris). The default region (`us-east-1`) will either fail silently, deliver emails with higher latency, or trigger compliance issues with EU data residency requirements.

## Triggers

- Setting up email delivery for a Directus/d9 instance
- `DIRECTUS_EMAIL_TRANSPORT` is set to `ses` or AWS SES is being configured
- The project is hosted in the EU or serves EU users

## Actions

1. Set the AWS region in your `.env` or environment:
   ```env
   DIRECTUS_EMAIL_TRANSPORT=ses
   AWS_REGION=eu-west-3
   AWS_SES_REGION=eu-west-3
   ```

2. Verify the sender identity (email or domain) is verified **in the eu-west-3 region** specifically:
   - Go to AWS Console → SES → **switch to eu-west-3** → Verified identities
   - A sender verified in us-east-1 is NOT verified in eu-west-3

3. Check SES is out of sandbox mode in eu-west-3 (or request production access)

4. Test email delivery: send a test email from Directus and verify it arrives

## Errors Prevented

- **Emails not delivered (wrong region)**: SES sender identity verification is region-specific. If you verify `noreply@example.com` in `us-east-1` but your app sends from `eu-west-3`, SES rejects the send silently (or returns a 400 that Directus may not surface clearly). Emails simply don't arrive.

- **GDPR compliance risk**: Sending EU user emails through `us-east-1` means email content (which may contain personal data) is processed in the US, potentially violating data residency requirements.

## Restrictions

- `eu-west-3` is Paris — this is the recommended region for France-based projects. Other EU regions (eu-west-1 Ireland, eu-central-1 Frankfurt) also work for GDPR compliance but verify SES availability.
- SES sandbox mode limits sending to verified addresses only — request production access before launch
- AWS IAM credentials used by Directus must have `ses:SendEmail` permission in the correct region
