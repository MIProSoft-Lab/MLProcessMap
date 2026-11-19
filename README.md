# MLProcessMap

A website to explore the Process Reference Model (PRM) for Machine Learning from the doctoral thesis. Anyone can browse it without signing in, and admins edit the model from `/admin` with their GitHub account.

- **Process map** of each PRM version, coloured by origin, with full-text search.
- **Process pages** with purpose, outcomes, inputs, outputs, activities, the sources of each activity, traceability to the ISO/IEC standards and the changes from the previous version.
- **Work products**: which process produces each input and which processes use each output.
- **Printable version** of each PRM version (`/<lang>/<version>/print/`), from the process map, or of one process, from its page: a cover, the process map, the contents, the processes, the references they cite and the acronyms they use. Options choose what goes on the cover and the map (with or without colours by origin), the processes, and the parts of each (origin, a process ID coloured by origin, the details of inputs and outputs, activity descriptions and sources, boxes to tick, space for notes), and the page breaks, page numbers, header and footer, text size and paper size. They are kept in the link, and the browser remembers the last ones used. The browser prints the page or saves it as a PDF.
- **Compare versions**: word-level diff of every process between two versions.
- **Lifecycle templates** that arrange the processes of a version into phases and iterations, and serve as starting points for the lifecycle builder.
- **Lifecycle builder**: create a custom lifecycle model for a project: choose the processes and activities, arrange them into phases with repetitions and feedback loops, preview its diagram, see inputs left without a producer, and export it as a Markdown checklist, CSV, JSON or a lifecycle template file (YAML), or print it: the printable version shows the model under its phases, without the activities left out, with the processes left out and why. The model lives in the link, and the JSON, YAML and CSV exports can be imported to share it as a file.

## How to cite

If you use the PRM, cite the thesis:

> Crespí Tobeña, A. (2027). _A Process Reference Model for Machine Learning Applications_ [Doctoral thesis, Universitat de les Illes Balears].

```bibtex
@phdthesis{crespi2027prm,
  author = {Crespí Tobeña, Antonio},
  title  = {A Process Reference Model for Machine Learning Applications},
  school = {Universitat de les Illes Balears},
  year   = {2027}
}
```

## License

- The PRM content in `content/` is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The names of processes and activities quoted from the ISO/IEC standards and the bibliographic data of cited works are excluded; see [`content/LICENSE`](content/LICENSE).
- The source code of the website is licensed under the [MIT License](LICENSE).

## Development

```sh
npm install
npm run dev
```

Requires Node 22.12 or newer.

The code is formatted with [Prettier](https://prettier.io): run `npm run format` before committing, as the deploy fails if `npm run format:check` does. The content in `content/` is left out, as the admin panel writes it in its own style.

## Content

All content is YAML under `content/`. The site is generated from it; nothing else holds model data.

```
content/
  site.yaml                         title and introduction, per language
  versions.yaml                     PRM versions, the default one, and the process map layout
  studies.yaml                      primary studies of the SLR (P1–P18)
  references.yaml                   bibliography used by the activities
  acronyms.yaml                     acronyms and their expansion, per language
  prm/<version>/
    processes/<lang>/P01.yaml …     one file per process and language
    work-products.yaml              type of each work product (information item, artifact, record)
  lifecycles/<lang>/<id>.yaml       lifecycle templates
  ui/<lang>.yaml                    interface text (menus, buttons, page texts)
```

Text fields accept `*emphasis*` and `**bold**`.

Acronyms listed in `acronyms.yaml` are marked wherever the text of the PRM uses them (process pages, lifecycle descriptions and the introduction): the site shows the acronym with its expansion on hover or tap, and shortens a written-out "Key Performance Indicators (KPIs)" to "KPIs", so the YAML can keep the wording of the thesis. The list is shown at the end of the References page. Bibliographic data is never changed.

### Content checks

The build checks the content against the rules below. An error stops the build with a message naming the file; a warning points at a place where the model may be unsound and is left to the author's judgement, so it is listed but does not stop the build.

| Rule                     | Severity | What it checks                                                                                                                                                                                                                                                              |
| ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `files`                  | error    | Every required file exists, every file is in a place the site reads, is valid YAML and matches its schema, and every translation has an English file.                                                                                                                       |
| `versions`               | error    | The default version exists, no version is called `latest`, every version has English process files, and its topology places each of its processes exactly once.                                                                                                             |
| `process-id`             | error    | The `id` in a process file matches the name of the file.                                                                                                                                                                                                                    |
| `process-unique-ids`     | error    | A process names each outcome and activity once, and lists a work product once among its inputs and once among its outputs.                                                                                                                                                  |
| `process-outcomes`       | error    | The inputs and outputs of a process serve outcomes of that process.                                                                                                                                                                                                         |
| `citations`              | error    | Activities cite studies in `studies.yaml` and references in `references.yaml`, and a study points to a reference that exists.                                                                                                                                               |
| `work-product-flow`      | error    | Every input is an output of a process of the same version or is marked `external` in its `work-products.yaml`, an external work product is not produced by any process, a work product has the same name everywhere, and `work-products.yaml` lists no unused work product. |
| `process-translations`   | error    | A translated process has the same outcomes, activities, inputs and outputs as the English one.                                                                                                                                                                              |
| `lifecycles`             | error    | A lifecycle uses a PRM version that exists, its phases list processes of that version, and phases return to phases that exist.                                                                                                                                              |
| `ui-translations`        | error    | Translated interface strings exist in `content/ui/en.yaml` and use the same `{placeholders}`.                                                                                                                                                                               |
| `outcome-evidence`       | warning  | Every outcome of a process is served by at least one of its outputs, the work product an assessor would look at to see it was achieved.                                                                                                                                     |
| `work-product-dead-ends` | warning  | Every work product a process produces is an input of another process, except records, which are kept as evidence of what was done.                                                                                                                                          |
| `lifecycle-dataflow`     | warning  | In a lifecycle, every required input of a process is external or produced in the same phase, an earlier one, or a later one that returns to it.                                                                                                                             |

To list every error and warning without building the site:

```sh
npm run check:content
```

The shape of each file is in `src/lib/content/schemas.ts`; the other checks are rules in `src/lib/validation/rules/`, each with a test in `src/lib/validation/validation.test.ts` (`npm test`).

### Translations

The English files are the reference. To translate a process, copy `content/prm/v2/processes/en/P09.yaml` to `content/prm/v2/processes/es/P09.yaml` and translate the text, keeping the IDs, outcome letters, work product IDs and sources. Untranslated processes are shown in English with a notice. The admin panel shows the languages side by side and copies the fields that are not translated.

Interface text is in `content/ui/<lang>.yaml`, grouped by section, and can be translated from the admin panel under **Interface text**. `en.yaml` is the reference: a string missing in another language is shown in English, and the build fails if a translation has a key that English does not or changes a placeholder such as `{n}`. To add a string, add it to `en.yaml` and use it in the code as `t('section.key')`.

### New PRM version

```sh
npm run new-version -- v3              # copy of the default version
npm run new-version -- v3 --from v1
```

This copies the process files, drops the list of changes (it belongs to the version that made them), and adds the version to `versions.yaml` as a draft. Edit it from the admin panel, then set its status to `current` and make it the default.

## Publishing on GitHub Pages

1. Push the repository to GitHub with `main` as the default branch.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. In **Settings → Environments → github-pages → Deployment branches and tags**, allow `main` and the tag pattern `v*`.
4. The site is deployed when a version tag is pushed, and pull requests are built to check them. Pushes to `main` or `thesis` are not deployed until the next release. To deploy the head of `main` without a release, run the workflow from the **Actions** tab.

### Releases

```sh
npm run release -- --dry-run   # show the next version and its notes
npm run release                # version worked out from the commits
npm run release -- minor       # or major, patch, or an exact version such as 1.4.0
```

This checks that `main` is clean and up to date, then runs the formatting, content and type checks, the tests and the build. It sets the new version in `package.json`, `package-lock.json` and `CITATION.cff` (with `date-released`), and adds the notes to `CHANGELOG.md`. It then opens `CHANGELOG.md` in Git's editor so you can fix the notes; to use VS Code, run `git config --global core.editor "code --wait"`. The saved text is what goes into the commit, the tag and the GitHub release. If you delete the version heading or answer no, the release is cancelled and the files are put back. `--no-edit` skips this step. Then it commits, tags `vX.Y.Z` and, after asking, pushes. The tag deploys both editions, and once the deploy succeeds the workflow publishes a GitHub release with the same notes. The deploy stops if the tag does not match `package.json` or is not on `main`.

The notes come from the commit messages since the last tag, which follow [Conventional Commits](https://www.conventionalcommits.org): `feat: …` is listed under Features and makes a minor release, `fix: …` is a patch, `content: …` (as the admin panel writes them) is listed under Content, and `feat!: …` or a `BREAKING CHANGE:` line in the body makes a major release. Merge commits are left out.

## Live and thesis editions

The site is published in two editions from this repository:

| Edition                                              | Branch   | Address    | Admin            |
| ---------------------------------------------------- | -------- | ---------- | ---------------- |
| Live: the tool as it keeps evolving                  | `main`   | `/`        | `/admin/`        |
| Thesis: the version described in the doctoral thesis | `thesis` | `/thesis/` | `/thesis/admin/` |

The thesis edition receives corrections and translations but no new features. It shows a banner that links to the live edition, and search engines do not index it; the live edition links to it from the footer. GitHub Pages publishes one site per repository, so each deploy builds both branches; keep `.github/workflows/deploy.yml` the same on both. The edition of a build is set by `PUBLIC_EDITION` (`live` or `thesis`, see `src/lib/edition.ts`); a local build is the live edition.

**Fixes and translations go to `thesis` first**, through `/thesis/admin/` or a commit on the branch, and are then carried to the live edition by merging:

```sh
git switch main
git merge thesis
```

Git only stops for a conflict where `main` has changed the same lines since, which is resolved once. Never merge `main` into `thesis`.

## Admin access

The admin panel at `/admin` is [Sveltia CMS](https://github.com/sveltia/sveltia-cms), with its editorial workflow. Saving an entry does not change `main` (or `thesis`, in the thesis edition). It commits to a branch `cms/<collection>/<slug>` and opens a pull request, which is checked and can be reviewed. **Publish** in the panel's Workflow board merges it. The change reaches the site with the next release, and the history of every change to the PRM is in git.

Only people with write access to the repository can save changes. Add admins as collaborators in **Settings → Collaborators**.

Admins can sign in in two ways:

- **Access token** (no setup): create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) for this repository with _Contents: Read and write_ and _Pull requests: Read and write_, and paste it in **Sign In Using Access Token**.
- **Sign in with GitHub**: deploy [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) to Cloudflare Workers (free) and set its URL as the repository variable `CMS_AUTH_URL` in **Settings → Secrets and variables → Actions → Variables**.
