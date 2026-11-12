#!/usr/bin/env python3
"""Disposable, cached image only, no network or production data. Exact-ID cleanup."""
import os, pathlib, subprocess, tempfile, time, shutil, json
# Fixture must never inherit a remote daemon or TLS selector. Keep DOCKER_CONFIG intact.
for selector in ("DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_TLS", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"):
    os.environ.pop(selector, None)
root=pathlib.Path(__file__).resolve().parents[1]
scratch=pathlib.Path(os.environ.get("TMPDIR", tempfile.gettempdir()))
fixture=pathlib.Path(tempfile.mkdtemp(prefix="orbita-appointments-fixture-",dir=scratch));fixture.chmod(0o755)
socket=fixture/"socket";socket.mkdir(mode=0o777);socket.chmod(0o777)
cid=None
volumes=[]
# Always use the local daemon; ordinary users with socket access need no sudo.
docker=["docker","--host=unix:///var/run/docker.sock"]
if subprocess.run(docker+["info"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode != 0 and shutil.which("sudo"):
    docker=["sudo","-n",*docker]
image="postgres:17-alpine@sha256:e5d2edd28b1f8d40a0a6c0c9cdc545b19b56a0d5d88f94bc11a97d970d4700d0"
try:
    subprocess.run(docker+["image","inspect",image],check=True,stdout=subprocess.DEVNULL)
    cid=subprocess.check_output(docker+["run","--pull=never","-d","--network=none","--label","orbita.fixture=appointments","--mount",f"type=bind,source={socket},target=/fixture-socket","-e","POSTGRES_USER=fixture","-e","POSTGRES_PASSWORD=fixture-local-only","-e","POSTGRES_DB=fixture","-e","PGHOST=/fixture-socket",image,"postgres","-c","listen_addresses=","-c","unix_socket_directories=/var/run/postgresql,/fixture-socket"],text=True).strip()
    print("Disposable container",cid,flush=True)
    mounts=json.loads(subprocess.check_output(docker+["inspect","--format","{{json .Mounts}}",cid],text=True))
    volumes=[m["Name"] for m in mounts if m["Type"]=="volume"]
    print("Exact fixture volumes",volumes,flush=True)
    for _ in range(60):
        initialized = "init process complete" in subprocess.check_output(docker+["logs",cid],stderr=subprocess.STDOUT,text=True)
        if initialized and subprocess.run(docker+["exec",cid,"pg_isready","-h","/fixture-socket","-U","fixture","-d","fixture"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
        if subprocess.check_output(docker+["inspect","--format","{{.State.Running}}",cid],text=True).strip()!="true":
            subprocess.run(docker+["logs",cid]);raise RuntimeError("fixture exited before readiness")
        time.sleep(0.5)
    else:raise RuntimeError("fixture did not become ready")
    env=dict(os.environ);env.pop("NODE_ENV",None)
    env["APPOINTMENT_TEST_DATABASE_URL"]="postgres:///fixture"
    env.update(PGHOST=str(socket),PGUSER="fixture",PGPASSWORD="fixture-local-only")
    result=subprocess.run(["npx","vitest","run","--config","vitest.appointments-postgres.config.mts","--maxWorkers=1"],cwd=root,env=env)
    raise SystemExit(result.returncode)
finally:
    if cid:
        subprocess.run(docker+["rm","-f","-v",cid],check=True)
        check=subprocess.run(docker+["inspect",cid],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        if check.returncode==0:raise RuntimeError("exact fixture cleanup failed")
        for volume in volumes:
            check=subprocess.run(docker+["volume","inspect",volume],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            if check.returncode==0:raise RuntimeError(f"fixture volume remains: {volume}")
        print("Exact container and volume cleanup verified",cid,volumes,flush=True)
    shutil.rmtree(fixture)
