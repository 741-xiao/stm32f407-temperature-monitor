"""Verify real TCP -> MySQL -> browser using a newly created, isolated database.

Requires MySQL, the packaged JAR and the workspace's existing Playwright install.
Only the database this process successfully creates is removed during cleanup.
"""
import argparse
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
import urllib.request

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--mysql", default="C:/mysql/mysql-8.4.4-winx64/mysql-8.4.4-winx64/bin/mysql.exe")
args = parser.parse_args()
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
db = "sht30_verify_" + secrets.token_hex(6)
env = dict(os.environ)
env["MYSQL_PWD"] = env.get("DB_PASSWORD", "")
if not env["MYSQL_PWD"]:
    raise SystemExit("DB_PASSWORD is required for the end-to-end database test")
env["DB_URL"] = f"jdbc:mysql://127.0.0.1:3306/{db}?useUnicode=true&characterEncoding=utf-8&useSSL=false&serverTimezone=Asia/Shanghai"
env["HTTP_PORT"] = "18080"
env["TCP_PORT"] = "15107"
env["SHT30_TEST_URL"] = "http://127.0.0.1:18080"
env["SHT30_TEST_TCP"] = "15107"
artifacts = root / "web/huiningLi/WebServer/target/sht30-e2e"
artifacts.mkdir(parents=True, exist_ok=True)
server = None
created = False
hidden = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0

def sql(statement):
    subprocess.run([args.mysql, "-h", "127.0.0.1", "-u", env.get("DB_USER", "root"),
                    "--execute", statement], env=env, check=True, timeout=20,
                   creationflags=hidden)

with (artifacts / "server.log").open("wb") as log:
    try:
        sql(f"CREATE DATABASE {db} CHARACTER SET utf8mb4")
        created = True
        server = subprocess.Popen(["java", "-Dfile.encoding=UTF-8", "-jar",
             str(root / "web/huiningLi/WebServer/target/WebServer-sht30.jar")],
             env=env, cwd=root, stdout=log, stderr=subprocess.STDOUT, creationflags=hidden)
        deadline = time.monotonic() + 50
        while True:
            if server.poll() is not None: raise RuntimeError("Server failed; see server.log")
            try:
                with urllib.request.urlopen(env["SHT30_TEST_URL"] + "/selectAllCollData", timeout=1) as response:
                    if response.status == 200: break
            except OSError:
                pass
            if time.monotonic() >= deadline: raise TimeoutError("Server did not start; see server.log")
            time.sleep(0.25)
        subprocess.run(["node", "web/tests/sht30-e2e.cjs"], cwd=root, env=env,
                       check=True, timeout=100, creationflags=hidden)
    finally:
        if server is not None:
            server.terminate()
            server.wait(timeout=15)
        if created:
            sql(f"DROP DATABASE {db}")
print("Isolated web verification complete; test service and database cleaned up.")
