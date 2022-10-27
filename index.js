const { Server } = require("@hocuspocus/server");
const { Logger } = require("@hocuspocus/extension-logger");
// const { Webhook, Events } = require("./extensions/webHook/index.js");
const { Database } = require("./extensions/extension-database/index.js");
const transformer = require("./transformer.js");
const { MongoClient } = require("mongodb");
const { mergeUpdates } = require("yjs");
const dbconfig = require('./dbconfig.json')
const { Redis } = require('@hocuspocus/extension-redis')

const uri = `mongodb://${dbconfig.username ? (dbconfig.username + ':' + dbconfig.password + '@') : ''}${dbconfig.host ?? 'localhost'}:${dbconfig.port ?? 27017}/`;

const client = new MongoClient(uri);

const DATABASE = dbconfig.db || 'hocus';
var db;
const initConnection = async () => {
  try {
    // Connect the client to the server
    await client.connect();
    // Establish and verify connection
    await client.db(DATABASE).command({ ping: 1 });
    db = client.db(DATABASE);
    console.log("Connected successfully to mongodb");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
};

const server = Server.configure({
  port: 4444,
  extensions: [
    new Redis(),
    new Database({
      transformer,
      fetch: async ({ documentName }) => {
        try {
          const documentsCollection = db.collection("documents");
          const document = await documentsCollection.findOne({
            documentName,
          });
          if (document) {
            const updatesField = document.updates;
            const updates = updatesField.map((update) => update.buffer);
            return { type: "document", data: mergeUpdates(updates) };
          } else {
            const documentsCollection = db.collection("stores");
            const document = await documentsCollection.findOne({
              documentName,
            });

            if (document) {
              const updatesField = document.updates;
              return { type: "store", data: updatesField };
            }
          }
        } catch (error) {
          throw error;
        }
      },
      store: async (data) => {
        const { documentName, state, document } = data;
        const json = transformer.fromYdoc(document);
        try {
          await mongoStoreState(db, documentName, state);
          await mongoStoreJSON(db, documentName, json);
        } catch (error) {
          throw error;
        }
      },
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

async function startServer() {
  await initConnection();
  server.listen();
}

// store state
async function mongoStoreState(db, documentName, state) {
  const documentsCollection = db.collection("documents");
  const document = await documentsCollection.findOne({
    documentName,
  });
  if (!document)
    documentsCollection.insertOne({
      documentName,
      updates: [state],
    });
  else {
    const updatesField = document ? document.updates : [];
    const existingUpdates = updatesField.map((update) => update.buffer);
    const updates = mergeUpdates([...existingUpdates, state]);
    documentsCollection.updateOne(
      { documentName },
      {
        // $push: { updates: state },
        $set: { updates: [updates] },
      }
    );
  }
}
// store json
async function mongoStoreJSON(db, documentName, json) {
  const documentsCollection = db.collection("stores");
  const document = await documentsCollection.findOne({
    documentName,
  });

  if (!document)
    documentsCollection.insertOne({
      documentName,
      updates: json,
    });
  else {
    documentsCollection.updateOne(
      { documentName },
      {
        // $push: { updates: state },
        $set: { updates: json },
      }
    );
  }
}
startServer();
