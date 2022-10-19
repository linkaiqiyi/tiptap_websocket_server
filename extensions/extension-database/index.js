const Y = require("yjs");

class Database {
  /**
   * Constructor
   */
  constructor(configuration) {
    /**
     * Default configuration
     */
    this.configuration = {
      fetch: async () => null,
      store: async () => null,
      transformer: null,
    };
    this.configuration = {
      ...this.configuration,
      ...configuration,
    };
  }
  /**
   * Get stored data from the database.
   */
  async onLoadDocument(data) {
    const update = await this.configuration.fetch(data);
    if (update) {
      if (update.type === "document") {
        if (update.data) {
          Y.applyUpdate(data.document, update.data);
        }
      } else if (update.type === "store") {
        if (update.data) {
          const document =
            typeof update.data === "string"
              ? JSON.parse(update.data)
              : update.data;
          for (const fieldName in document) {
            if (data.document.isEmpty(fieldName)) {
              data.document.merge(
                this.configuration.transformer.toYdoc(
                  document[fieldName],
                  fieldName
                )
              );
            }
          }
        }
      }
    }

    return data.document;
  }
  /**
   * Store new updates in the database.
   */
  async onStoreDocument(data) {
    return this.configuration.store({
      ...data,
      state: Buffer.from(Y.encodeStateAsUpdate(data.document)),
    });
  }
}

module.exports = { Database };
