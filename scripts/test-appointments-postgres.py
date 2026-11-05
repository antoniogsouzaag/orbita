#!/usr/bin/env python3
"""Disposable, cached image only, no network or production data. Exact-ID cleanup."""
import os, pathlib, subprocess, tempfile, time, shutil, json
root=pathlib.Path(__file__).resolve().parents[1]
scratch=pathlib.Path(os.environ.get("TMPDIR", str(pathlib.Path.home()/".hermes/cache/scratch")))
fixture=pathlib.Path(tempfile.mkdtemp(prefix="orbita-appointments-fixture-",dir=scratch));fixture.chmod(0o755)
socket=fixture/"socket";socket.mkdir(mode=0o777);socket.chmod(0o777)
cid=None
volumes=[]
try:
    subprocess.run(["sudo","-n","docker","image","inspect","postgres:17-alpine"],check=True,stdout=subprocess.DEVNULL)
    cid=subprocess.check_output(["sudo","-n","docker","run","--pull=never","-d","--network=none","--label","orbita.fixture=appointments","--mount",f"type=bind,source={socket},target=/fixture-socket","-e","POSTGRES_USER=fixture","-e","POSTGRES_PASSWORD=fixture-local-only","-e","POSTGRES_DB=fixture","-e","PGHOST=/fixture-socket","postgres:17-alpine","postgres","-c","listen_addresses=","-c","unix_socket_directories=/var/run/postgresql,/fixture-socket"],text=True).strip()
    print("Disposable container",cid,flush=True)
    mounts=json.loads(subprocess.check_output(["sudo","-n","docker","inspect","--format","{{json .Mounts}}",cid],text=True))
    volumes=[m["Name"] for m in mounts if m["Type"]=="volume"]
    print("Exact fixture volumes",volumes,flush=True)
    for _ in range(60):
        initialized = "init process complete" in subprocess.check_output(["sudo","-n","docker","logs",cid],stderr=subprocess.STDOUT,text=True)
        if initialized and subprocess.run(["sudo","-n","docker","exec",cid,"pg_isready","-h","/fixture-socket","-U","fixture","-d","fixture"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
        if subprocess.check_output(["sudo","-n","docker","inspect","--format","{{.State.Running}}",cid],text=True).strip()!="true":
            subprocess.run(["sudo","-n","docker","logs",cid]);raise RuntimeError("fixture exited before readiness")
        time.sleep(0.5)
    else:raise RuntimeError("fixture did not become ready")
    env=dict(os.environ);env.pop("NODE_ENV",None)
    env["APPOINTMENT_TEST_DATABASE_URL"]="postgres:///fixture"
    env.update(PGHOST=str(socket),PGUSER="fixture",PGPASSWORD="fixture-local-only")
    result=subprocess.run(["npx","vitest","run","--config","vitest.appointments-postgres.config.mts","--maxWorkers=1"],cwd=root,env=env)
    raise SystemExit(result.returncode)
finally:
    if cid:
        subprocess.run(["sudo","-n","docker","rm","-f","-v",cid],check=True)
        check=subprocess.run(["sudo","-n","docker","inspect",cid],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        if check.returncode==0:raise RuntimeError("exact fixture cleanup failed")
        for volume in volumes:
            check=subprocess.run(["sudo","-n","docker","volume","inspect",volume],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            if check.returncode==0:raise RuntimeError(f"fixture volume remains: {volume}")
        print("Exact container and volume cleanup verified",cid,volumes,flush=True)
    shutil.rmtree(fixture)
