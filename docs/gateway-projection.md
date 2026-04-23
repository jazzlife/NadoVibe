# Gateway Projection Contract

Gateway is the only browser-facing API boundary.

- Public clients use `/api/*`.
- Internal resource terms such as `waiting_for_capacity`, quota, backpressure, overload, and queue position are not returned by public APIs.
- Admin/operator capacity data is available only under `/api/admin/capacity`.
- Realtime stream uses SSE at `/api/stream?after=<offset>`.
- SSE was selected because Gateway stream is product event delivery, not Codex app-server transport. It remains independent from app-server experimental WebSocket transport.
- Reconnect uses durable event offsets and replays missed events after the supplied offset.
- Public projection responses are sanitized before being returned.
