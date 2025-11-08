
export function DGet(selector, container) {
  if (undefined === container) { container = document.body; }
  try {
    return container.querySelector(selector);
  } catch(error) {
    if (!container) {
      throw new Error(`[DGet] Container undefined for selector ${selector}: ${error.message}`)
    } else {
      throw new Error(`[DGet] Unable to find selector ${selector} in container ${container.tagName}#${container.id}: ${error.message}`);
    }
  }
}

export function table(contenu, css, id){
  return wrapIn('table', contenu, css, id)
}
export function span(contenu, css, id) {
  return wrapIn('span', contenu, css, id);
}
export function td(contenu, css, id){
  return wrapIn('td', contenu, css, id);
}
export function tr(contenu, css, id){
  return wrapIn('tr', contenu, css, id);
}

export function wrapIn(tag, contenu, css, id){
  let attrs = [];
  id && attrs.push(`id="${id}"`);
  css && attrs.push(`class="${css}"`);
  if (attrs.length) { attrs = ' ' + attrs.join(' ')}
  return `<${tag}${attrs}>${contenu}</${tag}>`;
}

export function stopEvent(ev){
  ev.stopPropagation();
  ev.preventDefault();
  return false;
}