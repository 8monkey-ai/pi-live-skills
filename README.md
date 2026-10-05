# pi-live-skills

Keeps the model's copy of your skills, context files, `SYSTEM.md` and `APPEND_SYSTEM.md` the same as the files on disk. Edit a skill during a session and the model sees the new version, with no `/reload`.

## Install

```bash
pi install npm:@8monkey/pi-live-skills
```

## How it works

Before each model request, the extension changes the skill text in the request. The session file keeps the original messages.

- **`read` results:** each full `read` of a skill file gets the current text of the file, also when the file is now larger than the `read` limits. If the file was deleted, the text becomes `This skill file no longer exists.`
- **`/skill:name` blocks:** each `<skill>` block gets the current body of its file. The block keeps its wrapper and your arguments. If the file was deleted, the body becomes `This skill file no longer exists.`

At the start of each prompt, the extension reads these parts from disk again. Pi then sends the changed parts of the system prompt to the model.

- **Context files:** `AGENTS.override.md`, `AGENTS.md` or `CLAUDE.md` from the agent folder and from each parent folder of the project, with files added and removed.
- **System prompt files:** `SYSTEM.md` and `APPEND_SYSTEM.md`. The project files in `.pi/` apply only when the project is trusted.
- **Skill list:** the name, description and location of each skill. Skills that you add to a skill folder or to the settings appear. A skill whose file was deleted drops out. Project skills and project settings apply only when the project is trusted.

A skill file is a file named `SKILL.md`, or a file in the skill list.

If you start pi with `--no-skills`, `--no-context-files`, `--system-prompt` or `--append-system-prompt`, that part of the prompt stays as it is.

## Limits

- Partial reads (`offset`, `limit` or a truncated result) and failed reads stay as they are.
- Skill text that the model read through `bash` stays as it is.
- A change to the system prompt during a tool loop reaches the model at your next prompt.
- Steer and follow-up messages that you queue during a run do not refresh the system prompt.
- A skill that you turn off in the settings stays in the skill list until `/reload`, while its file is on disk.
- `/skill:name` commands for added or renamed skills need `/reload`.
- New skills in a folder that you give with `--skill` need `/reload`.

## Development

```bash
npm run check
```

## License

MIT
