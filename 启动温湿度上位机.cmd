@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "web\huiningLi\WebServer\target\WebServer-sht30.jar" (
  echo 找不到上位机程序，请先运行 mvn -f web/huiningLi/pom.xml verify
  pause
  exit /b 1
)
echo 请确认 MySQL 已启动且 mytest 数据库存在。
echo 启动完成后打开 http://localhost:8080/
echo 开发板 TCP 接收端口为 5107；按 Ctrl+C 结束服务。
java -Dfile.encoding=UTF-8 -jar "web\huiningLi\WebServer\target\WebServer-sht30.jar"
pause
