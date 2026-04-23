# Codex App-Server Facts Encoded In Core

Sources checked on 2026-04-23:

- https://developers.openai.com/codex/app-server
- https://developers.openai.com/codex/cli/reference#codex-app-server

Core encodes the following product rules:

- App-server is the Codex rich-client integration boundary, not the product source of truth.
- Wire messages follow JSON-RPC 2.0 shape while omitting the `jsonrpc` header.
- Default transport is stdio JSONL.
- WebSocket transport is experimental and unsupported for production dependency.
- `initialize` and `initialized` must complete before other app-server methods.
- `thread/shellCommand` is denied because it runs outside the sandbox with full access.
- `command/exec*` and `fs/*` route through Workspace Runtime policy.
- Config, plugin, marketplace, skills config, and experimental mutation methods are denied unless a later Core feature gate explicitly enables them.
- WebSocket overload code `-32001` is retryable.
