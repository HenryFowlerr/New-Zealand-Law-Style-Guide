# NZ Law Cite

A browser-only citation builder for the **New Zealand Law Style Guide, Third
Edition (2018)**.

The project is an independent study aid. It is not affiliated with or endorsed
by the New Zealand Law Foundation or the publishers of the Style Guide.

## Safety model

NZ Law Cite is deliberately fail-closed:

- it never invents missing source facts;
- it does not generate a copyable citation while required details are missing;
- pasted text is treated as unverified until the user confirms the extracted
  source type and fields;
- every supported format links to its controlling Style Guide paragraph; and
- source types not yet fully tested are labelled unsupported rather than being
  approximated.

Accuracy still depends on the bibliographic facts supplied by the user and on
any institution-specific requirements that depart from Appendix 7.

## Verified formats in this release

- journal articles;
- books and texts;
- chapters in edited books;
- online commentaries and looseleaf services;
- papers and reports;
- New Zealand statutes;
- reported, neutral-citation-only, and unreported New Zealand cases; and
- general-style subsequent references.

The interface also composes multiple authorities into a single footnote using
semicolons, “and” before the final source, and one final full stop.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Run the complete release gate:

```bash
npm run verify
```

## Deployment

The repository includes a GitHub Pages workflow. Every deployment reruns type
checking, citation-rule tests, and the production build before publishing.

## Authoritative source

[New Zealand Law Style Guide, Third Edition](https://lawfoundation.org.nz/style-guide2019/index.html)
