export default function applyProperties(node, props, previous) {
  for (let propName in props) {
    const propValue = props[propName]

    if (propValue === undefined) {

    } else if (isObject(propValue)) {

    } else {

    }
  }
}

function removeProperty () {

}

function isObject(x) {
	return typeof x === 'object' && x !== null
}