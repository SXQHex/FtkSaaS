FROM node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b
RUN apt-get update && apt-get install -y --no-install-recommends python3 ca-certificates git curl xz-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /workspaces/FtkSaaS
