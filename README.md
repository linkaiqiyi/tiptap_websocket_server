# tiptap_websocket_server

### run
```
yarn start
```

### dbconfig.json
> 使用时需要在根目录添加 `dbconfig.json` 文件配置 连接的 mongo 数据库信息
```json
{
    "username": "yourusername",
    "password": "yourpassword",
    "host": "dbhost",
    "port": "dbport(27017)",
    "db": "db"
}
```