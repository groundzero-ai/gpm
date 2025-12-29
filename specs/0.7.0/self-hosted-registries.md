# Self-Hosted Registries

## Overview

Future support for self-hosted/private registries, drawing inspiration from npm, Docker, and Git.

## Registry Types

### 1. Git-Based Registry (Simple)

A git repository serving as a package registry.

```
https://github.com/myorg/opkg-registry.git

registry/
├── index.yml                    # Package index
│   packages:
│     my-pkg:
│       versions:
│         - 1.0.0
│         - 1.1.0
│
└── packages/
    └── my-pkg/
        ├── 1.0.0/
        │   ├── openpackage.yml
        │   └── commands/...
        └── 1.1.0/
            └── ...
```

**Configuration**:
```yaml
# ~/.openpackage/config.yml
registries:
  myorg: git:https://github.com/myorg/opkg-registry.git
```

**Usage**:
```bash
opkg install myorg/my-pkg@1.0.0
```

**Pros**:
- Git hosting is free/available everywhere
- Tags for versions
- Branch for channels (stable, beta)
- Full history and transparency

**Cons**:
- Git LFS may be needed for large packages
- Not as scalable for high-traffic registries

### 2. Static HTTP Registry (Scalable)

Static files served over HTTP/HTTPS.

```
https://registry.myorg.com/

packages/
├── my-pkg/
│   ├── index.json              # Version listing
│   ├── 1.0.0.tgz               # Tarball for download
│   └── 1.1.0.tgz
└── @scope/
    └── pkg/
        ├── index.json
        └── 2.0.0.tgz
```

**index.json**:
```json
{
  "name": "my-pkg",
  "versions": {
    "1.0.0": {
      "tarball": "https://registry.myorg.com/packages/my-pkg/1.0.0.tgz",
      "sha256": "abc123...",
      "dependencies": {}
    }
  }
}
```

**Configuration**:
```yaml
registries:
  internal: https://registry.myorg.com/
```

**Pros**:
- Works with any static hosting (S3, GitHub Pages, CDN)
- Highly scalable
- Standard HTTP caching

**Cons**:
- Requires index generation tooling
- No built-in auth (use hosting provider's auth)

### 3. Git Tags (No Separate Registry)

Use git tags on package repositories directly.

```yaml
packages:
  - name: my-package
    git: https://github.com/author/my-package.git
    ref: v1.0.0
```

**Pros**:
- Source code and package are one
- No separate registry infrastructure
- Works today with existing git support

**Cons**:
- No aggregated discovery/search
- Each package needs its own repo
- Slower (full clone vs tarball download)

## Configuration

### Registry Priority

```yaml
# ~/.openpackage/config.yml
registries:
  # Search in order listed
  default: https://registry.openpackage.dev    # Official
  myorg: git:https://github.com/myorg/opkg-registry.git
  internal: https://packages.internal.corp/opkg/
```

### Scoped Registries

```yaml
registries:
  default: https://registry.openpackage.dev
  
scopes:
  "@myorg": https://registry.myorg.com/
  "@internal": https://packages.internal.corp/
```

## Remote to Local Flow

When installing from a remote registry:

```
1. Fetch package metadata (index.json or git)
2. Download tarball (HTTP) or clone (git)
3. Extract to local registry: ~/.openpackage/registry/<name>/<version>/
4. Update workspace with path to local registry location
```

The local registry directory serves as a cache—same format as locally packed versions.

## Security Considerations

1. **HTTPS only**: All remote registries should use HTTPS
2. **Checksum verification**: Verify sha256 before extraction
3. **Authentication**: Support for tokens/API keys
4. **Signature verification**: Optional package signing (future)

## Comparison with Other Systems

| System | Protocol | Storage | Self-Hosted |
|--------|----------|---------|-------------|
| npm | HTTP REST | Tarballs + JSON | ✅ Verdaccio |
| Docker | HTTP API | Layers + manifests | ✅ Harbor |
| Go | HTTP + go.mod | Git or proxy | ✅ Athens |
| Cargo | HTTP + git index | .crate files | ✅ Cloudsmith |
| **OpenPackage** | HTTP/Git | Directories / .tgz | ✅ Planned |

## Implementation Status

| Feature | Status |
|---------|--------|
| Local registry (directories) | ✅ v0.7.0 |
| Git-based remote | 🔜 Planned |
| HTTP-based remote | 🔜 Planned |
| Scoped registries | 🔜 Planned |
| Package signing | 💭 Future |
