const StarterKit = require("@tiptap/starter-kit");
const { Comment } = require("./extensions/Schema/comment");

const { TiptapTransformer } = require("@hocuspocus/transformer");

module.exports = TiptapTransformer.extensions([
  StarterKit.configure({
    history: false,
  }),
  Comment,
]);
