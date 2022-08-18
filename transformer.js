const StarterKit = require("@tiptap/starter-kit");

const { TiptapTransformer } = require("@hocuspocus/transformer");

module.exports = TiptapTransformer.extensions([
  StarterKit.configure({
    history: false,
  }),
]);
