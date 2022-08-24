const {
  getMarkRange,
  getMarkAttributes,
  Mark,
  mergeAttributes,
} = require("@tiptap/core");
const { Plugin, TextSelection, PluginKey } = require("prosemirror-state");
const { getMarkType } = require("@tiptap/core");

/** comment 数据结构
  [
    {
      uuid,
      comments: [
        {
          uuid, content, userName, time
        }
      ]
    }
  ]
 */

const Comment = Mark.create({
  name: "comment",

  addOptions() {
    return {
      HTMLAttributes: {},
      isCommentModeOn: () => false,
    };
  },

  addAttributes() {
    return {
      comment: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-comment"),
        renderHTML: (attrs) => ({ "data-comment": attrs.comment }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-comment]",
        getAttrs: (el) => !!el.getAttribute("data-comment")?.trim() && null,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      mergeComment: ({ comment, uuid, isAdd = false }) => {
        return (params) => {
          const {
            tr,
            state: {
              doc,
              selection: { from, to },
            },
            state,
          } = params;

          let type = getMarkType("comment", state.schema);

          if (isAdd) {
            doc.nodesBetween(from, to, (node, pos) => {
              if (node.isText) {
                const trimmedFrom = Math.max(pos, from);
                const trimmedTo = Math.min(pos + node.nodeSize, to);
                const someHasMark = node.marks.find(
                  (mark) => mark.type === type
                );
                if (!someHasMark) {
                  tr.addMark(
                    trimmedFrom,
                    trimmedTo,
                    type.create({
                      comment: JSON.stringify([{ uuid, comments: [comment] }]),
                    })
                  );
                } else {
                  let oldAttrs = JSON.parse(someHasMark.attrs.comment);
                  if (Array.isArray(oldAttrs)) {
                    let targetComment = oldAttrs.find((v) => v.uuid === uuid);

                    if (targetComment) {
                      targetComment.comments.push(comment);
                    } else {
                      oldAttrs.push({ uuid, comments: [comment] });
                    }
                    tr.addMark(
                      trimmedFrom,
                      trimmedTo,
                      type.create({ comment: JSON.stringify(oldAttrs) })
                    );
                  }
                }
              }
            });
          } else {
            doc.descendants((childNode, pos) => {
              if (childNode.isText && childNode.nodeSize) {
                const someHasMark = childNode.marks.find(
                  (mark) => mark.type === type
                );
                if (someHasMark) {
                  let oldAttrs = JSON.parse(someHasMark.attrs.comment);
                  if (Array.isArray(oldAttrs)) {
                    let targetComment = oldAttrs.find((v) => v.uuid === uuid);
                    if (targetComment) {
                      targetComment.comments.push(comment);
                      let trimmedFrom = pos;
                      let trimmedTo = pos + childNode.nodeSize;
                      tr.addMark(
                        trimmedFrom,
                        trimmedTo,
                        type.create({ comment: JSON.stringify(oldAttrs) })
                      );
                    }
                  }
                }
              }
            });
          }
        };
      },
      deleteComment: ({ uuid, parentUuid = "" }) => {
        return (params) => {
          if (uuid) {
            const {
              tr,
              state: { doc },
              state,
            } = params;

            let type = getMarkType("comment", state.schema);
            doc.descendants((childNode, pos) => {
              if (childNode.isText && childNode.nodeSize) {
                const someHasMark = childNode.marks.find(
                  (mark) => mark.type === type
                );
                if (someHasMark) {
                  let oldAttrs = JSON.parse(someHasMark.attrs.comment);
                  if (Array.isArray(oldAttrs)) {
                    let trimmedFrom = pos;
                    let trimmedTo = pos + childNode.nodeSize;
                    if (parentUuid) {
                      let parentIndex = oldAttrs.findIndex(
                        (v) => v.uuid === parentUuid
                      );
                      if (
                        parentIndex !== -1 &&
                        Array.isArray(oldAttrs[parentIndex].comments)
                      ) {
                        let targetComment = oldAttrs[parentIndex].comments;
                        let index = targetComment.findIndex(
                          (v) => v.uuid === uuid
                        );

                        if (index !== -1) {
                          targetComment.splice(index, 1);
                          if (targetComment.length === 0) {
                            oldAttrs.splice(parentIndex, 1);
                          }

                          if (oldAttrs.length === 0) {
                            tr.removeMark(trimmedFrom, trimmedTo, type);
                          } else {
                            tr.addMark(
                              trimmedFrom,
                              trimmedTo,
                              type.create({ comment: JSON.stringify(oldAttrs) })
                            );
                          }
                        }
                      }
                    } else {
                      let index = oldAttrs.findIndex((v) => v.uuid === uuid);

                      if (index !== -1) {
                        oldAttrs.splice(index, 1);
                        if (oldAttrs.length === 0) {
                          tr.removeMark(trimmedFrom, trimmedTo, type);
                        } else {
                          tr.addMark(
                            trimmedFrom,
                            trimmedTo,
                            type.create({ comment: JSON.stringify(oldAttrs) })
                          );
                        }
                      }
                    }
                  }
                }
              }
            });
          }
        };
      },
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;

    const plugins = [
      new Plugin({
        key: new PluginKey("comment-plugin"),
        props: {
          handleClick(view, pos) {
            if (!extensionThis.options.isCommentModeOn()) return false;

            const { schema, doc, tr } = view.state;

            const range = getMarkRange(
              doc.resolve(pos),
              schema.marks.comment,
              getMarkAttributes(view.state, schema.marks.comment)
            );
            if (!range) return false;

            const [$start, $end] = [
              doc.resolve(range.from),
              doc.resolve(range.to),
            ];

            view.dispatch(tr.setSelection(new TextSelection($start, $end)));

            return true;
          },
          transformPasted: (slice) => {
            slice.content.content.map((node) => {
              node.descendants((childNode) => {
                let commentMarkIndex = childNode.marks.findIndex(
                  (v) => v.type.name === "comment"
                );

                if (commentMarkIndex !== -1) {
                  childNode.marks.splice(commentMarkIndex, 1);
                }
              });
            });
            return slice;
          },
        },
      }),
    ];

    return plugins;
  },
});

module.exports = { Comment };
