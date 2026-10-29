"""Build the Keil project headlessly with installed ARM Compiler 5 (no flashing)."""
import argparse
from pathlib import Path
import subprocess
import sys
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
parser = argparse.ArgumentParser()
parser.add_argument("--toolchain", type=Path, default=Path("C:/Keil/ARM/ARMCC/bin"))
args = parser.parse_args()
project = root / "Project"
output = project / "Build"
output.mkdir(exist_ok=True)
target = ET.parse(project / "LCD.uvprojx").find("./Targets/Target")
controls = target.find("./TargetOption/TargetArmAds/Cads/VariousControls")
includes = [str((project / path).resolve()) for path in controls.findtext("IncludePath").split(";")]
defines = controls.findtext("Define").split(",")
objects = []
log = []

def run(tool, *arguments):
    result = subprocess.run([str(args.toolchain / (tool + ".exe")), *map(str, arguments)],
                            cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    text = result.stdout.decode("utf-8", errors="replace")
    log.append(text)
    (output / "build.log").write_text("".join(log), encoding="utf-8")
    if text: print(text.rstrip())
    if result.returncode: raise SystemExit(result.returncode)

for file in target.findall("./Groups/Group/Files/File"):
    source = (project / file.findtext("FilePath")).resolve()
    if source.suffix.lower() not in (".c", ".s"): continue
    obj = output / (source.stem + ".o")
    objects.append(obj)
    if source.suffix.lower() == ".c":
        flags = ["--cpu=Cortex-M4.fp.sp", "--c99", "--no_multibyte_chars", "-O1", "-g", "--split_sections"]
        # Vendor legacy sources keep their normal diagnostics. All application
        # sources are checked with warnings treated as errors.
        if source.parent.name in ("Main", "Serial", "WiFi", "SHT30", "Chinese"):
            flags += ["--diag_error=warning"]
        for folder in includes: flags += ["-I", folder]
        for define in defines: flags += ["-D", define]
        run("armcc", *flags, "-c", source, "-o", obj)
    else:
        run("armasm", "--cpu=Cortex-M4.fp.sp", "--apcs=interwork", "-g", source, "-o", obj)

scatter = output / "LCD.sct"
scatter.write_text("""LR_IROM1 0x08000000 0x00100000 {
  ER_IROM1 0x08000000 0x00100000 {
    *.o (RESET, +First)
    *(InRoot$$Sections)
    .ANY (+RO)
  }
  RW_IRAM1 0x20000000 0x00020000 { .ANY (+RW +ZI) }
}
""", encoding="ascii")
run("armlink", "--cpu=Cortex-M4.fp.sp", *objects, "--strict", "--scatter", scatter,
    "--summary_stderr", "--info=summarysizes,sizes,totals", "--map", "--callgraph", "--symbols",
    "--list", output / "LCD.map", "-o", output / "LCD.axf")
run("fromelf", "--i32combined", "--output", output / "LCD.hex", output / "LCD.axf")
print(f"Firmware ready: {output / 'LCD.hex'}")
