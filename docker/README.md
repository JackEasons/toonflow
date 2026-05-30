# drama-studio Docker Release

Build on the packaging machine:

```sh
./scripts/deploy/build-local-docker-image.sh
```

Upload the whole `docker/` directory to the server, then start:

```sh
cd docker
./up.sh
```

Service URLs:

- App: `http://server-ip:6001`
- Admin: `http://server-ip:6001/admin`
- MySQL: `server-ip:13306`
- MinIO API: `http://server-ip:19000`
- MinIO Console: `http://server-ip:19001`

MinIO console login:

- User: `minioadmin`
- Password: `minioadmin`

The compose file includes healthchecks and an `autoheal` watcher. If `mysql`,
`minio`, `server`, or `app` becomes unhealthy, `autoheal` restarts it through
the Docker socket. If a process exits, Docker's `restart: unless-stopped`
policy restarts it.

Static files can be replaced directly under `www/app` and `www/admin`.
Server files can be replaced under `server/assets`, `server/modelPrompt`,
`server/models`, `server/oss`, `server/serve`, `server/skills`, and
`server/vendor`.
