const StarterKit = require("@tiptap/starter-kit");
const { isChangeOrigin } = require("@tiptap/extension-collaboration")

const { Comment } = require("./extensions/Schema/comment");
const { UniqueID } = require("./extensions/Schema/tiptap-unique-id");

const { TiptapTransformer } = require("@hocuspocus/transformer");

module.exports = TiptapTransformer.extensions([
  StarterKit.configure({
    history: false,
  }),
  Comment,
  UniqueID.configure({
    attributeName: "uid",
    types: ["heading", "paragraph"],
    filterTransaction: (transaction) => !isChangeOrigin(transaction),
  }),,
]);
