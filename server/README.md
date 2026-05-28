# DramaStudio Server

## 环境变量配置

服务启动时会自动加载环境变量文件。默认优先级如下：

1. `DRAMASTUDIO_ENV_FILE` 或 `ENV_FILE` 指定的文件
2. 当前工作目录下的 `.env`
3. `server/.env`

本地运行时直接修改 `server/.env`。该文件不会提交到 Git；可提交和复制的模板是 `server/.env.example`。

## 数据库配置

数据库连接通过 `.env` 配置，不需要改代码。服务只使用 MySQL：

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=dramastudio
MYSQL_CONNECTION_LIMIT=10
MYSQL_CHARSET=utf8mb4
MYSQL_TIMEZONE=Z
MYSQL_AUTO_CREATE_DATABASE=false
```

## 初始化 MySQL 数据

`data/mysql-init.sql` 是当前迁移好的 MySQL 初始化脚本。先手动创建/选择 MySQL 数据库，再导入该 SQL 文件。

默认不会在服务启动时自动执行 `CREATE DATABASE`，因为普通业务账号通常没有建库权限。只有当 `MYSQL_USER` 具备建库权限时，才可以把 `MYSQL_AUTO_CREATE_DATABASE` 改为 `true`。
