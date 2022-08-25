const { Server } = require("@hocuspocus/server");
const { Logger } = require("@hocuspocus/extension-logger");
const { Webhook, Events } = require("./extensions/webHook/index.js");

const transformer = require("./transformer.js");

const server = Server.configure({
  port: 4444,
  extensions: [
    new Webhook({
      url: "http://127.0.0.1:3000/save-data",
      transformer,
      // debounce: 5000,
      events: [
        Events["onChange"],
        Events["onConnect"],
        // Events["onCreate"],
        Events["onDisconnect"],
      ],
    }),
    new Logger({
      // onLoadDocument: true,
      // onChange: false,
      // onStoreDocument: false,
      // onConnect: false,
      // onDisconnect: false,
      // onUpgrade: false,
      // onRequest: false,
      // onDestroy: false,
      // onConfigure: false,
    }),
  ],
  async onAuthenticate(data) {
    const { token, requestParameters } = data;
    const name = requestParameters.get("name");
    const password = requestParameters.get("password");
    const room = requestParameters.get("room");
    if (token !== "super-secret-token") {
      throw new Error("Not authorized!");
    }

    return {
      user: {
        id: 1234,
        name: name,
        password,
        room,
      },
    };
  },
});

server.listen();
