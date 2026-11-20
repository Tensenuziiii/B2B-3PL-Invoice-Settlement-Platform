\# Security Notes



\## Known npm audit advisories (deferred)



Two advisories appear in `npm audit --omit=dev` but are non-blocking for the MVP.



\### deepmerge-ts < 8.0.0 (HIGH)

\- \*\*Source:\*\* transitive via `prisma` CLI

\- \*\*Impact:\*\* CLI-only. Not invoked at runtime by our application.

\- \*\*Fix deferred to:\*\* P7 (hardening phase)

\- \*\*Reason:\*\* Fix requires downgrading `prisma` from 6.19.3 to 6.12.0, which breaks `Prisma.defineExtension`.



\### js-yaml 5.0.0–5.4.0 (MODERATE)

\- \*\*Source:\*\* transitive via `@nestjs/swagger`

\- \*\*Impact:\*\* Only triggered when parsing YAML. Our Swagger docs use TypeScript decorators, not YAML.

\- \*\*Fix deferred to:\*\* P7 (hardening phase)

\- \*\*Reason:\*\* Fix requires upgrading `@nestjs/swagger` to 12.x, which is a breaking change.



Both will be re-evaluated in P7 with the option of pinning newer versions after full test suite re-run.

