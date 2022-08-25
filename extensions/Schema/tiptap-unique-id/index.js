const {
  Extension,
  /* findChildren, */ findChildrenInRange,
} = require("@tiptap/core");
const { Plugin, PluginKey } = require("prosemirror-state");
const { Slice, Fragment } = require("prosemirror-model");
const { v4 } = require("uuid");
const { Transform } = require("prosemirror-transform");

/**
 * Returns a new `Transform` based on all steps of the passed transactions.
 */
function combineTransactionSteps(oldDoc, transactions) {
  const transform = new Transform(oldDoc);
  transactions.forEach((transaction) => {
    transaction.steps.forEach((step) => {
      transform.step(step);
    });
  });
  return transform;
}

/**
 * Removes duplicated values within an array.
 * Supports numbers, strings and objects.
 */
function removeDuplicates(array, by = JSON.stringify) {
  const seen = {};
  return array.filter((item) => {
    const key = by(item);
    return Object.prototype.hasOwnProperty.call(seen, key)
      ? false
      : (seen[key] = true);
  });
}

/**
 * Removes duplicated ranges and ranges that are
 * fully captured by other ranges.
 */
function simplifyChangedRanges(changes) {
  const uniqueChanges = removeDuplicates(changes);
  return uniqueChanges.length === 1
    ? uniqueChanges
    : uniqueChanges.filter((change, index) => {
        const rest = uniqueChanges.filter((_, i) => i !== index);
        return !rest.some((otherChange) => {
          return (
            change.oldStart >= otherChange.oldStart &&
            change.oldEnd <= otherChange.oldEnd &&
            change.newStart >= otherChange.newStart &&
            change.newEnd <= otherChange.newEnd
          );
        });
      });
}
/**
 * Returns a list of changed ranges
 * based on the first and last state of all steps.
 */
function getChangedRanges(transform) {
  const { mapping, steps } = transform;
  const changes = [];
  mapping.maps.forEach((stepMap, index) => {
    // This accounts for step changes where no range was actually altered
    // e.g. when setting a mark, node attribute, etc.
    // @ts-ignore
    if (!stepMap.ranges.length) {
      const step = steps[index];
      if (step.from === undefined || step.to === undefined) {
        return;
      }
      changes.push({
        oldStart: step.from,
        oldEnd: step.to,
        newStart: step.from,
        newEnd: step.to,
      });
    } else {
      stepMap.forEach((from, to) => {
        const newStart = mapping.slice(index).map(from, -1);
        const newEnd = mapping.slice(index).map(to);
        const oldStart = mapping.invert().map(newStart, -1);
        const oldEnd = mapping.invert().map(newEnd);
        changes.push({
          oldStart,
          oldEnd,
          newStart,
          newEnd,
        });
      });
    }
  });
  return simplifyChangedRanges(changes);
}

/**
 * Returns a list of duplicated items within an array.
 */
function findDuplicates(items) {
  const filtered = items.filter((el, index) => items.indexOf(el) !== index);
  const duplicates = removeDuplicates(filtered);
  return duplicates;
}

const UniqueID = Extension.create({
  name: "uniqueID",
  // we’ll set a very high priority to make sure this runs first
  // and is compatible with `appendTransaction` hooks of other extensions
  priority: 10000,
  addOptions() {
    return {
      attributeName: "id",
      types: [],
      generateID: () => v4(),
      filterTransaction: null,
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          [this.options.attributeName]: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute(`data-${this.options.attributeName}`),
            renderHTML: (attributes) => {
              if (!attributes[this.options.attributeName]) {
                return {};
              }
              return {
                [`data-${this.options.attributeName}`]:
                  attributes[this.options.attributeName],
              };
            },
          },
        },
      },
    ];
  },
  // 在有后端数据连接时 onCreate 时取消 初始化默认内容的 id
  // check initial content for missing ids
  // onCreate() {
  //     const { view, state } = this.editor;
  //     const { tr, doc } = state;
  //     const { types, attributeName, generateID } = this.options;
  //     const nodesWithoutId = findChildren(doc, node => {
  //         return types.includes(node.type.name)
  //         && node.attrs[attributeName] === null;
  //     });
  //     nodesWithoutId.forEach(({ node, pos }) => {
  //         tr.setNodeMarkup(pos, undefined, {
  //             ...node.attrs,
  //             [attributeName]: generateID(),
  //         });
  //     });
  //     view.dispatch(tr);
  // },
  addProseMirrorPlugins() {
    let dragSourceElement = null;
    let transformPasted = false;
    return [
      new Plugin({
        key: new PluginKey("uniqueID"),
        appendTransaction: (transactions, oldState, newState) => {
          const docChanges =
            transactions.some((transaction) => transaction.docChanged) &&
            !oldState.doc.eq(newState.doc);
          const filterTransactions =
            this.options.filterTransaction &&
            transactions.some((tr) => {
              var _a, _b;
              return !((_b = (_a = this.options).filterTransaction) === null ||
              _b === void 0
                ? void 0
                : _b.call(_a, tr));
            });
          if (!docChanges || filterTransactions) {
            return;
          }
          const { tr } = newState;
          const { types, attributeName, generateID } = this.options;
          const transform = combineTransactionSteps(oldState.doc, transactions);
          const { mapping } = transform;
          // get changed ranges based on the old state
          const changes = getChangedRanges(transform);
          changes.forEach((change) => {
            const newRange = {
              from: change.newStart,
              to: change.newEnd,
            };
            const newNodes = findChildrenInRange(
              newState.doc,
              newRange,
              (node) => {
                return types.includes(node.type.name);
              }
            );
            const newIds = newNodes
              .map(({ node }) => node.attrs[attributeName])
              .filter((id) => id !== null);
            const duplicatedNewIds = findDuplicates(newIds);
            newNodes.forEach(({ node, pos }) => {
              var _a;
              // instead of checking `node.attrs[attributeName]` directly
              // we look at the current state of the node within `tr.doc`.
              // this helps to prevent adding new ids to the same node
              // if the node changed multiple times within one transaction
              const id =
                (_a = tr.doc.nodeAt(pos)) === null || _a === void 0
                  ? void 0
                  : _a.attrs[attributeName];
              if (id === null) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  [attributeName]: generateID(),
                });
                return;
              }
              // check if the node doesn’t exist in the old state
              const { deleted } = mapping.invert().mapResult(pos);
              const newNode = deleted && duplicatedNewIds.includes(id);
              if (newNode) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  [attributeName]: generateID(),
                });
              }
            });
          });
          if (!tr.steps.length) {
            return;
          }
          return tr;
        },
        // we register a global drag handler to track the current drag source element
        view(view) {
          const handleDragstart = (event) => {
            var _a;
            dragSourceElement = (
              (_a = view.dom.parentElement) === null || _a === void 0
                ? void 0
                : _a.contains(event.target)
            )
              ? view.dom.parentElement
              : null;
          };
          window.addEventListener("dragstart", handleDragstart);
          return {
            destroy() {
              window.removeEventListener("dragstart", handleDragstart);
            },
          };
        },
        props: {
          // `handleDOMEvents` is called before `transformPasted`
          // so we can do some checks before
          handleDOMEvents: {
            // only create new ids for dropped content while holding `alt`
            // or content is dragged from another editor
            drop: (view, event) => {
              var _a;
              if (
                dragSourceElement !== view.dom.parentElement ||
                ((_a = event.dataTransfer) === null || _a === void 0
                  ? void 0
                  : _a.effectAllowed) === "copy"
              ) {
                dragSourceElement = null;
                transformPasted = true;
              }
              return false;
            },
            // always create new ids on pasted content
            paste: () => {
              transformPasted = true;
              return false;
            },
          },
          // we’ll remove ids for every pasted node
          // so we can create a new one within `appendTransaction`
          transformPasted: (slice) => {
            if (!transformPasted) {
              return slice;
            }
            const { types, attributeName } = this.options;
            const removeId = (fragment) => {
              const list = [];
              fragment.forEach((node) => {
                // don’t touch text nodes
                if (node.isText) {
                  list.push(node);
                  return;
                }
                // check for any other child nodes
                if (!types.includes(node.type.name)) {
                  list.push(node.copy(removeId(node.content)));
                  return;
                }
                // remove id
                const nodeWithoutId = node.type.create(
                  {
                    ...node.attrs,
                    [attributeName]: null,
                  },
                  removeId(node.content),
                  node.marks
                );
                list.push(nodeWithoutId);
              });
              return Fragment.from(list);
            };
            // reset check
            transformPasted = false;
            return new Slice(
              removeId(slice.content),
              slice.openStart,
              slice.openEnd
            );
          },
        },
      }),
    ];
  },
});

module.exports= { UniqueID };
