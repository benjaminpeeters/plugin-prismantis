# bin

Claude Code puts this folder on the Bash tool's PATH while the plugin is loaded, and only when
the folder exists. prismantis ships no executable here: the folder is here so that
/meta:check-claude-config can see whether the plugin is loaded in a session (section "ARE THE
ENABLED PLUGINS ACTUALLY LOADED?"). Keep it, and keep it in sandbox.filesystem.denyWrite like
the manifest: anything placed here runs by bare name. This fork adds the file; upstream has no
bin/, so it never conflicts in a merge.
