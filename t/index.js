var vitrualDom = require('../index')
var h = vitrualDom.h
var diff = vitrualDom.diff
var patch = vitrualDom.patch
var createElement = vitrualDom.create

// 1: Create a function that declares what the DOM should look like
function children (arr) {
    return arr.map((val, i) => {
        return h('div', {key: '_' + val})
    })
}

function render(arr)  {
    return h('div', {
        style: {
            textAlign: 'center',
            lineHeight: (100 + count) + 'px',
            border: '1px solid red',
            width: (100 + count) + 'px',
            height: (100 + count) + 'px'
        }
    }, children(arr));
}

// 2: Initialise the document
var count = 0;      // We need some app data. Here we just store a count.

var tree = render([1, 2, 3]);               // We need an initial tree
var rootNode = createElement(tree);     // Create an initial root DOM node ...
document.body.appendChild(rootNode);    // ... and it should be in the document

// 3: Wire up the update logic
setTimeout(function () {
      count++;

      var newTree = render([1, 3, 4]);
      var patches = diff(tree, newTree);
      rootNode = patch(rootNode, patches);
      tree = newTree;
}, 1000);