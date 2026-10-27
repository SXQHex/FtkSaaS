FROM node:24.22.1-bookworm@sha256:6449e19d8184d84062525b6a7524def03146c2cb04a7f08b076680d0e8e4240a
RUN apt-get update && apt-get install -y --no-install-recommends python3 ca-certificates git curl xz-utils && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /workspaces/FtkSaaS
