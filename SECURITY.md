# Security policy

## Email credentials

This public website must never contain a mailbox password, SMTP password, SMTP
connection string, or provider control-panel export. Public contact forms must
use a narrowly scoped form-provider key and must not authenticate directly to
Titan or another mailbox from browser code.

If server-side email is added later, keep credentials in the hosting provider's
encrypted secret store, use a dedicated sending identity rather than a human or
administrator mailbox, and rotate the credential immediately after suspected
exposure.

## Public deployment boundary

The root GitHub Pages deployment is only for the public marketing website.
Internal dashboards, database schemas, administrative tools, and serverless
function source are excluded in `_config.yml`. They should be moved to a private
repository and deployed behind authenticated access before further use.

## Reporting a vulnerability

Do not include passwords, tokens, customer information, or exploit payloads in a
public issue. Contact the site administrator privately using the address listed
on the website.
