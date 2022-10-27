# tiptap_websocket_server

### run
```
yarn start
```

### dbconfig.json
> 使用时需要在根目录添加 `dbconfig.json` 文件配置 连接的 mongo 数据库信息
```json
{
    "mongodbUri": "mongodb://username:password@host:port/db",
    "mongodbConfigure": {
        "host": "",
        "port": 27017,
        "username": "",
        "password": "",
        "db": "db"
    },
    "redisConfigure": {
        "host": "",
        "port": 6376,
        "options": {
            "host": "",
            "port": 6376,
            "password": "",
            "connectTimeout": 30000,
            "db": 0
        }
    }
}
```