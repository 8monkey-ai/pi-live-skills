# pi-live-skills

Keeps the model's copy of your skills, context files, `SYSTEM.md` and `APPEND_SYSTEM.md` the same as the files on disk. Edit a skill during a session and the model sees the new version, with no `/reload`.

## Install

```bash
pi install npm:@8monkey/pi-live-skills
```

## How it works

Before each model request, the extension changes the request. The session file keeps the original messages.

- **`read` results:** each full `read` of a `SKILL.md` file gets the current text of the file, also when the file is now larger than the `read` limits. If the file was deleted, the text becomes `This skill file no longer exists.`
- **`/skill:name` blocks:** each `<skill>` block gets the current body of its file. The block keeps its wrapper and your arguments. If the file was deleted, the body becomes `This skill file no longer exists.`

## Limits

- Partial reads (`offset`, `limit` or a truncated result) and failed reads stay as they are.
- Skill text that the model read through `bash` stays as it is.

## Development

```bash
npm run check
```

## License

MIT
