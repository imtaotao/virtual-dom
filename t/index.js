// var vitrualDom = require('../index')
// var h = vitrualDom.h
// var diff = vitrualDom.diff
// var patch = vitrualDom.patch
// var createElement = vitrualDom.create

import v, { h, diff, patch, create } from './api.js'

// 1: Create a function that declares what the DOM should look like
function children (arr) {
    return arr.map((val, i) => {
        return h('span', {key: '_' + val}, [val])
    })
}

function render(arr, is)  {
    return h('div', {
        style: {
            textAlign: 'center',
            lineHeight: (100 + count) + 'px',
            border: '1px solid red',
            width: (100 + count) + 'px',
            height: (100 + count) + 'px'
        }
    }, !is ? children(arr) : ['', '', '', '']);
}

// 2: Initialise the document
var count = 0;      // We need some app data. Here we just store a count.

var tree = render([1, null, 2, 4, 3]);               // We need an initial tree
var rootNode = create(tree);     // Create an initial root DOM node ...
document.body.appendChild(rootNode);    // ... and it should be in the document

// 3: Wire up the update logic
setTimeout(function () {
        count++;

        var newTree = render([1, null, 'nulll', 3, 4]);
        var patches = diff(tree, newTree);
        rootNode = patch(rootNode, patches);
        tree = newTree;
}, 1000);

// import h from './api/h'

// var vnode = h('div', {
//   style: {
//     textAlign: 'center',
//     border: '1px solid red',
//   }
// }, [1, null, 'taotao', 3])

// console.log(vnode);
