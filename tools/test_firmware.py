"""Run hardware-independent behavior tests with a local C99 compiler."""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
(root / "tests/build").mkdir(exist_ok=True)
executable = root / "tests/build/test_firmware.exe"
subprocess.run(["gcc", "-std=c99", "-Wall", "-Wextra", "-Werror", "-IMain",
                "-IUSER/Serial", "-IUSER/WiFi", "tests/test_firmware.c",
                "Main/app_logic.c", "USER/WiFi/wifi_link.c", "-o", str(executable)],
               cwd=root, check=True)
subprocess.run([str(executable)], cwd=root, check=True)
