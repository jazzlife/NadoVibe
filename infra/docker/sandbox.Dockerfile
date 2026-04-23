FROM ubuntu:24.04

ARG CODE_SERVER_VERSION=4.96.4

ENV DEBIAN_FRONTEND=noninteractive
ENV CODE_SERVER_BIND_ADDR=127.0.0.1:8080

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    dumb-init \
    git \
    openssh-client \
    ripgrep \
    nodejs \
    npm \
    python3 \
  && curl -fsSL https://github.com/coder/code-server/releases/download/v${CODE_SERVER_VERSION}/code-server_${CODE_SERVER_VERSION}_amd64.deb -o /tmp/code-server.deb \
  && apt-get install -y /tmp/code-server.deb \
  && rm -rf /var/lib/apt/lists/* /tmp/code-server.deb

RUN useradd -m -s /bin/bash coder \
  && mkdir -p /workspace /artifacts /home/coder/.local/share/code-server /home/coder/.cache/code-server \
  && chown -R coder:coder /workspace /artifacts /home/coder

USER coder
WORKDIR /workspace

HEALTHCHECK --interval=10s --timeout=5s --retries=10 \
  CMD curl -fsS http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["code-server", "--bind-addr", "127.0.0.1:8080", "--auth", "none", "--user-data-dir", "/home/coder/.local/share/code-server", "--extensions-dir", "/home/coder/.local/share/code-server/extensions", "/workspace"]
