# pi-live-skills

Edit your skills and project instructions during a pi session. The model uses the new version at your next prompt, with no `/reload` and no new session.

## Install

```bash
pi install npm:@8monkey/pi-live-skills
```

## What you get

- **Skill edits take effect immediately.** Change a skill that the model already loaded, and the model works from the new text, not from the old copy in the chat history. This applies to skills that the model read and to skills that you start with `/skill:name`.
- **New skills appear.** Add a skill to a skill folder or to your settings, and the model can find it and use it.
- **Deleted skills go away.** Remove a skill, and the model stops seeing it. If the model loaded it earlier, the model gets a note that the file no longer exists.
- **Project instructions stay current.** Edit `AGENTS.md`, `CLAUDE.md`, `SYSTEM.md` or `APPEND_SYSTEM.md`, and the model follows the new rules.
- **Your session history stays as it was.** The session file keeps the original messages. Only the text that pi sends to the model changes.

Your choices at startup still apply. If you start pi with `--no-skills`, `--no-context-files`, `--system-prompt` or `--append-system-prompt`, that part stays as it is. Project skills and project files in `.pi/` apply only when you trust the project.

## Example

You write a skill and test it in the same session:

1. Ask the model to do a task with the skill.
2. Edit `SKILL.md` in your editor.
3. Ask again. The model uses the edited skill, and you keep the rest of the conversation.

## When you still need `/reload`

- To start a new or renamed skill with `/skill:name`.
- To remove a skill that you turned off in the settings, while its file is still on disk.
- To add new skills from a folder that you gave with `--skill`.

## Limits

- Edits to project instructions or to the skill list reach the model at your next prompt, not during a run that is in progress.
- The model may see that its earlier replies used the old text, and it can say so.
- The first request after a change can cost more, because the provider prompt cache restarts from the changed part.
- Skill text that the model read only in part, or through `bash`, stays as it is.

## How it works

Pi loads skills, context files and the system prompt at startup, and it does not update messages that are already in the chat. This extension fixes that in two places:

- Before each model request, it puts the current text of each skill into the skill messages of the request.
- At the start of each prompt, it reads the skill list, the context files and the system prompt files from disk again. Pi then sends only the parts that changed.

## Development

```bash
npm run check
```

## License

MIT
