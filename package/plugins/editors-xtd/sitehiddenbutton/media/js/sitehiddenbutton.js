import { JoomlaEditorButton } from 'editor-api';

(function () {
  if (window.__SiteHiddenButtonLoaded) {
    return;
  }

  window.__SiteHiddenButtonLoaded = true;

  const SHORTCODE_OPEN = '{site-hidden}';
  const SHORTCODE_CLOSE = '{/site-hidden}';
  const SHORTCODE_RE = /\{site-hidden\}([\s\S]*?)\{\/site-hidden\}/gi;
  const EDITOR_STYLE_ID = 'sitehiddenbutton-editor-styles';
  const BLOCK_TAGS = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'CAPTION', 'COLGROUP', 'DETAILS', 'DIV', 'DL',
    'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TBODY', 'TD',
    'TFOOT', 'TH', 'THEAD', 'TR', 'UL',
  ]);

  const ICONS = {
    edit: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l8.06-8.06.92.92L5.92 19.58zM20.71 7.04a1.004 1.004 0 0 0 0-1.42L18.37 3.29a1.004 1.004 0 0 0-1.42 0l-1.54 1.54 3.75 3.75 1.55-1.54z" fill="currentColor"/></svg>',
    done: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/></svg>',
    remove: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 4c-1.66 0-3 1.34-3 3v3c0 .55-.45 1-1 1v2c.55 0 1 .45 1 1v3c0 1.66 1.34 3 3 3h1v-2H8c-.55 0-1-.45-1-1v-3c0-.77-.29-1.47-.76-2 .47-.53.76-1.23.76-2V7c0-.55.45-1 1-1h1V4H8zm8 0h-1v2h1c.55 0 1 .45 1 1v3c0 .77.29 1.47.76 2-.47.53-.76 1.23-.76 2v3c0 .55-.45 1-1 1h-1v2h1c1.66 0 3-1.34 3-3v-3c0-.55.45-1 1-1v-2c-.55 0-1-.45-1-1V7c0-1.66-1.34-3-3-3zM6.7 5.29 5.29 6.7l12 12 1.41-1.41-12-12zm12 1.41L17.29 5.29l-12 12 1.41 1.41 12-12z" fill="currentColor"/></svg>',
  };

  function uid() {
    return `sh-${Math.random().toString(36).slice(2, 10)}`;
  }

  function t(key, fallback) {
    return window.Joomla?.Text?._(key) || fallback;
  }

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function resolveEditorSurfaceColor(doc) {
    const view = doc?.defaultView || window;
    const candidates = [doc?.body, doc?.documentElement];

    for (let index = 0; index < candidates.length; index += 1) {
      const node = candidates[index];

      if (!node) {
        continue;
      }

      try {
        const color = view.getComputedStyle(node).backgroundColor;

        if (color && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') {
          return color;
        }
      } catch (error) {
        // Ignore unreadable computed styles.
      }
    }

    return '#fff';
  }

  function normalizeInnerHtml(html) {
    return String(html || '').trim() ? String(html) : '<p></p>';
  }

  function normalizeTextContent(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\u200b/g, '')
      .trim();
  }

  function normalizeBodyHtml(html, doc) {
    const ownerDocument = doc || document;
    const container = ownerDocument.createElement('div');

    container.innerHTML = String(html || '');

    if (!normalizeTextContent(container.textContent) && !container.querySelector('*')) {
      return '<p></p>';
    }

    const hasTopLevelBlock = Array.from(container.childNodes).some((node) => node.nodeType === 1 && BLOCK_TAGS.has(node.tagName));

    if (!hasTopLevelBlock) {
      const paragraph = ownerDocument.createElement('p');

      while (container.firstChild) {
        paragraph.appendChild(container.firstChild);
      }

      container.appendChild(paragraph);
    }

    return container.innerHTML || '<p></p>';
  }

  function isShortcodeTextNode(node, shortcode) {
    return !!node && node.nodeType === 3 && normalizeTextContent(node.nodeValue) === shortcode;
  }

  function normalizeShortcodeMarkup(html, doc) {
    const ownerDocument = doc || document;
    const nodeFilter = (ownerDocument.defaultView && ownerDocument.defaultView.NodeFilter) || window.NodeFilter;
    const container = ownerDocument.createElement('div');
    const paragraphs = [];

    container.innerHTML = String(html || '');
    container.querySelectorAll('p').forEach((paragraph) => paragraphs.push(paragraph));

    paragraphs.forEach((paragraph) => {
      const text = normalizeTextContent(paragraph.textContent);

      if (text !== SHORTCODE_OPEN && text !== SHORTCODE_CLOSE) {
        return;
      }

      paragraph.replaceWith(ownerDocument.createTextNode(text));
    });

    if (!nodeFilter) {
      return container.innerHTML;
    }

    const walker = ownerDocument.createTreeWalker(container, nodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return isShortcodeTextNode(node, SHORTCODE_OPEN) || isShortcodeTextNode(node, SHORTCODE_CLOSE)
          ? nodeFilter.FILTER_ACCEPT
          : nodeFilter.FILTER_REJECT;
      },
    });
    const shortcodeNodes = [];

    while (walker.nextNode()) {
      shortcodeNodes.push(walker.currentNode);
    }

    shortcodeNodes.forEach((node) => {
      if (isShortcodeTextNode(node, SHORTCODE_OPEN)) {
        cleanupDirection(node, 'nextSibling');
      }

      if (isShortcodeTextNode(node, SHORTCODE_CLOSE)) {
        cleanupDirection(node, 'previousSibling');
      }
    });

    return container.innerHTML;
  }

  function unwrapElementPreservingChildren(element) {
    if (!element || !element.parentNode) {
      return;
    }

    const parent = element.parentNode;

    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }

    parent.removeChild(element);
  }

  function sanitizeLegacyBodyHtml(html) {
    const container = document.createElement('div');
    container.innerHTML = normalizeInnerHtml(html);

    container.querySelectorAll('.sh-marker').forEach((node) => node.remove());
    container.querySelectorAll('.site-hidden-toolbar').forEach((node) => node.remove());
    container.querySelectorAll('.site-hidden-badge').forEach((node) => node.remove());
    container.querySelectorAll('.site-hidden-inner').forEach((node) => unwrapElementPreservingChildren(node));
    container.querySelectorAll('.site-hidden-block').forEach((node) => {
      const nestedBody = node.querySelector(':scope > .site-hidden-body');

      if (nestedBody) {
        node.innerHTML = nestedBody.innerHTML;
      }

      unwrapElementPreservingChildren(node);
    });

    return normalizeBodyHtml(container.innerHTML, container.ownerDocument);
  }

  function buildToolbarHtml(editing) {
    return `${buildToolbarButtonHtml('edit', editing)}${buildToolbarButtonHtml('remove', false)}`;
  }

  function isWhitespaceTextNode(node) {
    return !!node && node.nodeType === 3 && !normalizeTextContent(node.nodeValue);
  }

  function isEditorEmptyParagraph(node) {
    if (!node || node.nodeType !== 1 || node.tagName !== 'P') {
      return false;
    }

    if (node.querySelector('img,video,audio,iframe,object,embed,svg,math,table,ul,ol,pre,blockquote,figure,hr,input,textarea,select,button')) {
      return false;
    }

    return !normalizeTextContent(node.textContent);
  }

  function cleanupDirection(node, direction) {
    let sibling = node ? node[direction] : null;

    while (isWhitespaceTextNode(sibling) || isEditorEmptyParagraph(sibling)) {
      const current = sibling;
      sibling = sibling[direction];
      current.remove();
    }
  }

  function cleanupBlockBoundaries(block) {
    if (!block || !block.parentNode) {
      return;
    }

    cleanupDirection(block, 'previousSibling');
    cleanupDirection(block, 'nextSibling');
  }

  function getSelectedHtmlTiny(editor) {
    try {
      return editor?.selection?.getContent({ format: 'html' }) || '';
    } catch (error) {
      return '';
    }
  }

  function listTinyEditors() {
    if (!window.tinymce) {
      return [];
    }

    if (window.tinymce.EditorManager && Array.isArray(window.tinymce.EditorManager.editors)) {
      return window.tinymce.EditorManager.editors;
    }

    if (Array.isArray(window.tinymce.editors)) {
      return window.tinymce.editors;
    }

    if (window.tinymce.editors && typeof window.tinymce.editors === 'object') {
      try {
        return Object.values(window.tinymce.editors);
      } catch (error) {
        return [];
      }
    }

    return [];
  }

  function findTinyByDoc(doc) {
    const editors = listTinyEditors();

    for (let index = 0; index < editors.length; index += 1) {
      const editor = editors[index];

      try {
        if (editor && editor.getDoc && editor.getDoc() === doc) {
          return editor;
        }
      } catch (error) {
        // Ignore editors that are not ready.
      }
    }

    return window.tinymce?.activeEditor || null;
  }

  function runEditorMutation(editor, mutation) {
    if (typeof mutation !== 'function') {
      return;
    }

    if (editor?.undoManager && typeof editor.undoManager.transact === 'function') {
      editor.undoManager.transact(mutation);
      return;
    }

    mutation();
  }

  function markEditorDirty(editor) {
    if (!editor) {
      return;
    }

    if (typeof editor.nodeChanged === 'function') {
      editor.nodeChanged();
    }

    if (typeof editor.setDirty === 'function') {
      editor.setDirty(true);
    }
  }

  function escapeSelectorValue(value) {
    return window.CSS?.escape ? CSS.escape(value) : value;
  }

  function getBlockSelector(id) {
    return `.site-hidden-block[data-site-hidden-id="${escapeSelectorValue(id)}"]`;
  }

  function buildToolbarButtonHtml(action, editing) {
    if (action === 'edit') {
      const label = editing
        ? t('PLG_EDITORSXTD_SITEHIDDENBUTTON_DONE', 'Finish editing hidden content')
        : t('PLG_EDITORSXTD_SITEHIDDENBUTTON_EDIT', 'Edit hidden content');
      const activeClass = editing ? ' site-hidden-toolbar-btn--active' : '';
      const icon = editing ? ICONS.done : ICONS.edit;

      return `<button type="button" class="site-hidden-toolbar-btn${activeClass}" data-site-hidden-action="edit" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}" aria-pressed="${editing ? 'true' : 'false'}">${icon}</button>`;
    }

    const removeLabel = t('PLG_EDITORSXTD_SITEHIDDENBUTTON_REMOVE', 'Remove site-hidden wrapper');

    return `<button type="button" class="site-hidden-toolbar-btn" data-site-hidden-action="remove" title="${escapeAttr(removeLabel)}" aria-label="${escapeAttr(removeLabel)}">${ICONS.remove}</button>`;
  }

  function buildBlockHtml(id, innerHtml, editing) {
    const bodyHtml = sanitizeLegacyBodyHtml(innerHtml);
    const editState = editing ? '1' : '0';
    const blockClasses = ['site-hidden-block'];

    if (!editing) {
      blockClasses.push('mceNonEditable');
    }

    if (editing) {
      blockClasses.push('site-hidden-block--editing');
    }

    return `<div class="${blockClasses.join(' ')}" data-site-hidden="1" data-site-hidden-id="${escapeAttr(id)}" data-site-hidden-editing="${editState}" contenteditable="false" ${editing ? '' : 'data-mce-contenteditable="false" '}data-mce-resize="false" data-mce-placeholder="1"><div class="site-hidden-toolbar" contenteditable="false" data-mce-contenteditable="false" data-site-hidden-label="${escapeAttr(t('PLG_EDITORSXTD_SITEHIDDENBUTTON_BADGE', 'Hidden text'))}">${buildToolbarHtml(editing)}</div><div class="site-hidden-body" contenteditable="${editing ? 'true' : 'false'}" data-mce-contenteditable="${editing ? 'true' : 'false'}" spellcheck="${editing ? 'true' : 'false'}">${bodyHtml}</div></div>`;
  }

  function htmlToFragment(doc, html) {
    const container = doc.createElement('div');
    container.innerHTML = html || '';

    const fragment = doc.createDocumentFragment();

    while (container.firstChild) {
      fragment.appendChild(container.firstChild);
    }

    return fragment;
  }

  function buildShortcodeFragment(block) {
    const doc = block.ownerDocument;
    const fragment = doc.createDocumentFragment();
    const body = block.querySelector('.site-hidden-body');
    const container = doc.createElement('div');

    fragment.appendChild(doc.createTextNode(SHORTCODE_OPEN));

    if (body) {
      container.innerHTML = sanitizeLegacyBodyHtml(body.innerHTML);

      while (container.firstChild) {
        fragment.appendChild(container.firstChild);
      }
    }

    fragment.appendChild(doc.createTextNode(SHORTCODE_CLOSE));

    return fragment;
  }

  function normalizeDocumentShortcodes(doc) {
    if (!doc || !doc.body) {
      return;
    }

    const normalizedHtml = normalizeShortcodeMarkup(doc.body.innerHTML, doc);

    if (normalizedHtml !== doc.body.innerHTML) {
      doc.body.innerHTML = normalizedHtml;
    }
  }

  function syncEditorFieldValue(editor) {
    const field = editor?.targetElm
      || (typeof editor?.getElement === 'function' ? editor.getElement() : null)
      || document.getElementById(editor?.id || '');

    if (!field || typeof field.value !== 'string') {
      return;
    }

    field.value = normalizeShortcodeMarkup(field.value, field.ownerDocument || document);
  }

  function ensureEditorStyles(doc) {
    if (!doc) {
      return;
    }

    if (doc.documentElement) {
      doc.documentElement.style.setProperty('--site-hidden-editor-page-bg', resolveEditorSurfaceColor(doc));
    }

    if (doc.getElementById(EDITOR_STYLE_ID)) {
      return;
    }

    const style = doc.createElement('style');
    style.id = EDITOR_STYLE_ID;
    style.textContent = [
      '.site-hidden-block{display:flex;width:100%;box-sizing:border-box;flex-direction:column;gap:.55rem;margin:.75rem 0;padding:.75rem;border:1px solid #d4b16a;border-radius:.45rem;background:#fff8e6;color:#6c4a00;cursor:default;}',
      '.site-hidden-block--editing{border-color:#c77900;background:#fff3cc;box-shadow:0 0 0 2px rgba(199,121,0,.14);}',
      '.site-hidden-toolbar{display:flex;align-items:center;gap:.15rem;min-height:1.75rem;color:#6c4a00;font:700 .82em/1.3 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;}',
      '.site-hidden-toolbar::before{content:"\\01FAE5  " attr(data-site-hidden-label);margin-right:auto;letter-spacing:0;text-transform:none;}',
      '.site-hidden-toolbar[data-mce-selected],.site-hidden-toolbar[data-mce-selected="1"],.site-hidden-toolbar[data-mce-selected="inline-boundary"],.site-hidden-toolbar.mce-selected,.site-hidden-toolbar.mce-item-selected,.site-hidden-toolbar.mceEditable,.site-hidden-toolbar.mceNonEditable{outline:none!important;box-shadow:none!important;border:0!important;}',
      '.site-hidden-toolbar-btn{background:transparent;border:none;padding:.2rem;cursor:pointer;color:#9a6b00;display:inline-flex;align-items:center;justify-content:center;border-radius:.25rem;line-height:0;}',
      '.site-hidden-toolbar-btn:hover{background:#f3e0b7;color:#7c5300;}',
      '.site-hidden-toolbar-btn--active{background:#e1c16e;color:#5b3d00;}',
      '.site-hidden-toolbar-btn svg{display:block;}',
      '.site-hidden-toolbar-btn:focus,.site-hidden-toolbar-btn:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(199,121,0,.35);}',
      '.site-hidden-body{width:100%;color:#2f2a24;}',
      '.site-hidden-body[data-mce-selected],.site-hidden-body[data-mce-selected="1"],.site-hidden-body[data-mce-selected="inline-boundary"],.site-hidden-body.mce-selected,.site-hidden-body.mce-item-selected,.site-hidden-body.mceEditable,.site-hidden-body.mceNonEditable{outline:none!important;box-shadow:none!important;border:0!important;}',
      '.site-hidden-body[contenteditable="false"]{cursor:default;}',
      '.site-hidden-body[contenteditable="true"]{cursor:text;background:var(--site-hidden-editor-page-bg,#fff);outline:none;border-radius:0;padding:0;}',
      '.site-hidden-body[contenteditable="true"]:focus{box-shadow:0 0 0 2px rgba(199,121,0,.35);}',
      '.site-hidden-body > :first-child{margin-top:0;}',
      '.site-hidden-body > :last-child{margin-bottom:0;}',
    ].join('\n');

    (doc.head || doc.documentElement).appendChild(style);
  }

  function applyBlockState(block) {
    if (!block) {
      return;
    }

    const editing = block.getAttribute('data-site-hidden-editing') === '1';
    const toolbar = block.querySelector('.site-hidden-toolbar');
    const body = block.querySelector('.site-hidden-body');
    let editButton = null;
    let removeButton = null;

    block.classList.toggle('mceNonEditable', !editing);
    block.classList.toggle('site-hidden-block--editing', editing);
    block.setAttribute('contenteditable', 'false');
    block.removeAttribute('draggable');

    if (editing) {
      block.removeAttribute('data-mce-contenteditable');
    } else {
      block.setAttribute('data-mce-contenteditable', 'false');
    }

    if (toolbar) {
      toolbar.setAttribute('contenteditable', 'false');
      toolbar.setAttribute('data-mce-contenteditable', 'false');
      toolbar.removeAttribute('draggable');
      toolbar.setAttribute('data-site-hidden-label', t('PLG_EDITORSXTD_SITEHIDDENBUTTON_BADGE', 'Hidden text'));
      toolbar.innerHTML = buildToolbarHtml(editing);
      editButton = toolbar.querySelector('[data-site-hidden-action="edit"]');
      removeButton = toolbar.querySelector('[data-site-hidden-action="remove"]');
    }

    if (body) {
      body.innerHTML = sanitizeLegacyBodyHtml(body.innerHTML);

      body.setAttribute('contenteditable', editing ? 'true' : 'false');
      body.setAttribute('data-mce-contenteditable', editing ? 'true' : 'false');
      body.removeAttribute('draggable');
      body.setAttribute('spellcheck', editing ? 'true' : 'false');
    }

    if (editButton) {
      editButton.innerHTML = editing ? ICONS.done : ICONS.edit;
      editButton.classList.toggle('site-hidden-toolbar-btn--active', editing);
      editButton.setAttribute('aria-pressed', editing ? 'true' : 'false');

      const label = editing
        ? t('PLG_EDITORSXTD_SITEHIDDENBUTTON_DONE', 'Finish editing hidden content')
        : t('PLG_EDITORSXTD_SITEHIDDENBUTTON_EDIT', 'Edit hidden content');

      editButton.setAttribute('title', label);
      editButton.setAttribute('aria-label', label);
    }

    if (removeButton) {
      const removeLabel = t('PLG_EDITORSXTD_SITEHIDDENBUTTON_REMOVE', 'Remove site-hidden wrapper');
      removeButton.setAttribute('title', removeLabel);
      removeButton.setAttribute('aria-label', removeLabel);
    }

    cleanupBlockBoundaries(block);
  }

  function focusEditableBody(block, editor) {
    const body = block?.querySelector('.site-hidden-body');

    if (!body) {
      return;
    }

    if (!body.innerHTML.trim()) {
      body.innerHTML = '<p></p>';
    }

    if (editor) {
      try {
        editor.focus();
        const doc = editor.getDoc();
        const selection = doc.getSelection();
        const range = doc.createRange();

        range.selectNodeContents(body);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        editor.nodeChanged();
      } catch (error) {
        try {
          body.focus();
        } catch (focusError) {
          // Best effort only.
        }
      }

      return;
    }

    try {
      body.focus();
    } catch (error) {
      // Best effort only.
    }
  }

  function setBlockEditing(block, editing, focusAfter) {
    block.setAttribute('data-site-hidden-editing', editing ? '1' : '0');
    applyBlockState(block);

    if (focusAfter && editing) {
      focusEditableBody(block, findTinyByDoc(block.ownerDocument));
    }
  }

  function restorePreviewBlocks(root) {
    if (!root || !root.querySelectorAll) {
      return;
    }

    root.querySelectorAll('.site-hidden-block').forEach((block) => {
      if (block.parentElement && block.parentElement.closest('.site-hidden-block')) {
        return;
      }

      block.replaceWith(buildShortcodeFragment(block));
    });
  }

  function removeBlock(editor, block) {
    if (!block) {
      return;
    }

    const doc = block.ownerDocument;
    const body = block.querySelector('.site-hidden-body');
    const fragment = htmlToFragment(doc, body ? body.innerHTML : '');

    if (editor) {
      runEditorMutation(editor, () => {
        block.replaceWith(fragment);
      });
      markEditorDirty(editor);
      return;
    }

    block.replaceWith(fragment);
  }

  function getSiteHiddenBlock(target) {
    return target?.closest ? target.closest('.site-hidden-block') : null;
  }

  function hasJceGlobal(win) {
    try {
      return !!(win?.WFEditor || win?.JCE || win?.jce);
    } catch (error) {
      return false;
    }
  }

  function getEditorElementText(editor) {
    const parts = [];

    try {
      parts.push(editor?.id);
      parts.push(editor?.getContainer && editor.getContainer()?.id);
      parts.push(editor?.getContainer && editor.getContainer()?.className);
      parts.push(editor?.targetElm?.id);
      parts.push(editor?.targetElm?.className);
      parts.push(typeof editor?.getElement === 'function' ? editor.getElement()?.id : '');
      parts.push(typeof editor?.getElement === 'function' ? editor.getElement()?.className : '');
    } catch (error) {
      // Best effort detection only.
    }

    return parts.join(' ').toLowerCase();
  }

  function documentHasJceMarkers(doc) {
    const win = doc?.defaultView || window;
    const selectors = [
      '[id*="jce" i]',
      '[class*="jce" i]',
      '[id*="wf-editor" i]',
      '[class*="wf-editor" i]',
      '[id*="wf_editor" i]',
      '[class*="wf_editor" i]',
    ].join(',');

    try {
      const parentDoc = win?.parent && win.parent !== win ? win.parent.document : document;

      return !!parentDoc?.querySelector?.(selectors);
    } catch (error) {
      return false;
    }
  }

  function isJceEditorDocument(doc) {
    const win = doc?.defaultView || window;
    const editor = findTinyByDoc(doc);
    const editorText = getEditorElementText(editor);

    return hasJceGlobal(win)
      || hasJceGlobal(win?.parent)
      || hasJceGlobal(window)
      || editorText.includes('jce')
      || editorText.includes('wf-editor')
      || editorText.includes('wf_editor')
      || documentHasJceMarkers(doc);
  }

  function handleJceSiteHiddenDragStart(event, doc) {
    if (!isJceEditorDocument(doc)) {
      return;
    }

    const block = getSiteHiddenBlock(event.target);

    if (!block) {
      return;
    }

    if (event.dataTransfer) {
      try {
        event.dataTransfer.effectAllowed = 'none';
        event.dataTransfer.clearData();
      } catch (error) {
        // Some editors expose a restricted DataTransfer object.
      }
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function decorateDocument(doc) {
    if (!doc || !doc.body) {
      return;
    }

    ensureEditorStyles(doc);

    if (doc.querySelector('.site-hidden-body[contenteditable="true"]')) {
      return;
    }

    const normalizedHtml = normalizeShortcodeMarkup(doc.body.innerHTML, doc);
    const currentHtml = normalizedHtml !== doc.body.innerHTML ? normalizedHtml : doc.body.innerHTML;

    if (normalizedHtml !== doc.body.innerHTML) {
      doc.body.innerHTML = normalizedHtml;
    }

    if (currentHtml.indexOf(SHORTCODE_OPEN) !== -1) {
      const decoratedHtml = currentHtml.replace(SHORTCODE_RE, (match, innerHtml) => buildBlockHtml(uid(), innerHtml, false));

      if (decoratedHtml !== currentHtml) {
        doc.body.innerHTML = decoratedHtml;
      }
    }

    doc.querySelectorAll('.site-hidden-block').forEach((block) => applyBlockState(block));
  }

  function bindEditorDoc(doc) {
    if (!doc || !doc.body) {
      return;
    }

    ensureEditorStyles(doc);

    if (!doc._siteHiddenToolbarBound) {
      doc._siteHiddenToolbarBound = true;

      const getActionButton = (target) => target?.closest ? target.closest('[data-site-hidden-action]') : null;
      const runToolbarAction = (button) => {
        if (!button) {
          return;
        }

        const block = button.closest('.site-hidden-block');

        if (!block) {
          return;
        }

        const editor = findTinyByDoc(doc);
        const action = button.getAttribute('data-site-hidden-action');

        if (action === 'edit') {
          const nextState = block.getAttribute('data-site-hidden-editing') !== '1';

          if (editor) {
            runEditorMutation(editor, () => {
              setBlockEditing(block, nextState, false);
            });
            markEditorDirty(editor);
          } else {
            setBlockEditing(block, nextState, false);
          }

          if (nextState) {
            focusEditableBody(block, editor);
          }

          return;
        }

        if (action === 'remove') {
          removeBlock(editor, block);
        }
      };

      doc.body.addEventListener('click', (event) => {
        const button = getActionButton(event.target);

        if (!button) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        runToolbarAction(button);
      }, true);

      doc.body.addEventListener('keydown', (event) => {
        const actionButton = getActionButton(event.target);

        if (actionButton && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          event.stopPropagation();
          runToolbarAction(actionButton);
          return;
        }

        const body = event.target.closest && event.target.closest('.site-hidden-body[contenteditable="true"]');

        if (!body || event.key !== 'Escape') {
          return;
        }

        const block = body.closest('.site-hidden-block');

        if (!block) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const editor = findTinyByDoc(doc);

        if (editor) {
          runEditorMutation(editor, () => {
            setBlockEditing(block, false, false);
          });
          markEditorDirty(editor);
        } else {
          setBlockEditing(block, false, false);
        }
      }, true);

      doc.body.addEventListener('dragstart', (event) => handleJceSiteHiddenDragStart(event, doc), true);
    }

    if (!doc._siteHiddenDecorateBound) {
      doc._siteHiddenDecorateBound = true;

      ['input', 'keyup', 'paste', 'mouseup', 'blur', 'drop'].forEach((eventName) => {
        doc.addEventListener(eventName, () => {
          setTimeout(() => decorateDocument(doc), 30);
        }, true);
      });
    }

    decorateDocument(doc);
  }

  function bindTinyEditors() {
    listTinyEditors().forEach((editor) => {
      try {
        bindEditorDoc(editor.getDoc && editor.getDoc());

        if (!editor._siteHiddenButtonBound) {
          editor._siteHiddenButtonBound = true;

          editor.on('BeforeSetContent', (event) => {
            if (typeof event.content === 'string') {
              event.content = normalizeShortcodeMarkup(event.content, editor.getDoc && editor.getDoc());
            }
          });

          editor.on('BeforeGetContent', () => {
            const doc = editor.getDoc && editor.getDoc();

            restorePreviewBlocks(doc);
            normalizeDocumentShortcodes(doc);
          });

          editor.on('init SetContent LoadContent Change Undo Redo', () => {
            setTimeout(() => decorateDocument(editor.getDoc && editor.getDoc()), 30);
          });

          editor.on('GetContent SaveContent', (event) => {
            if (typeof event.content === 'string') {
              event.content = normalizeShortcodeMarkup(event.content, editor.getDoc && editor.getDoc());
            }

            setTimeout(() => {
              decorateDocument(editor.getDoc && editor.getDoc());
              syncEditorFieldValue(editor);
            }, 0);
          });

          editor.on('PreProcess', (event) => {
            if (event.node && event.node.querySelectorAll) {
              restorePreviewBlocks(event.node);
              event.node.innerHTML = normalizeShortcodeMarkup(event.node.innerHTML, event.node.ownerDocument || editor.getDoc());
            }
          });
        }
      } catch (error) {
        // Ignore editors that are not ready yet.
      }
    });
  }

  function bindIframes() {
    document.querySelectorAll('iframe').forEach((iframe) => {
      if (!iframe._siteHiddenButtonBound) {
        iframe._siteHiddenButtonBound = true;
        iframe.addEventListener('load', () => {
          try {
            bindEditorDoc(iframe.contentDocument);
          } catch (error) {
            // Ignore inaccessible iframes.
          }
        });
      }

      try {
        bindEditorDoc(iframe.contentDocument);
      } catch (error) {
        // Ignore inaccessible iframes.
      }
    });
  }

  function decorateEditors() {
    bindTinyEditors();
    bindIframes();
  }

  function restoreEditorToField(editor) {
    restorePreviewBlocks(editor.getDoc && editor.getDoc());
    normalizeDocumentShortcodes(editor.getDoc && editor.getDoc());

    if (editor.save) {
      editor.save();
    }

    syncEditorFieldValue(editor);
  }

  function isElementVisible(element) {
    if (!element || !element.ownerDocument?.documentElement?.contains(element)) {
      return false;
    }

    try {
      const style = (element.ownerDocument.defaultView || window).getComputedStyle(element);

      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
    } catch (error) {
      // Fall back to layout checks below.
    }

    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  }

  function isEditorVisualMode(editor) {
    try {
      if (typeof editor?.isHidden === 'function') {
        return !editor.isHidden();
      }
    } catch (error) {
      // Fall back to DOM visibility checks below.
    }

    try {
      const container = editor?.getContainer && editor.getContainer();

      if (container) {
        return isElementVisible(container);
      }
    } catch (error) {
      // Fall back to iframe visibility below.
    }

    try {
      if (editor?.iframeElement) {
        return isElementVisible(editor.iframeElement);
      }
    } catch (error) {
      // Treat unknown editors as visual so submit remains conservative.
    }

    return true;
  }

  function restoreEditors() {
    listTinyEditors().forEach((editor) => {
      try {
        restoreEditorToField(editor);
      } catch (error) {
        // Ignore editors that are not ready yet.
      }
    });

    document.querySelectorAll('iframe').forEach((iframe) => {
      try {
        restorePreviewBlocks(iframe.contentDocument);
        normalizeDocumentShortcodes(iframe.contentDocument);
      } catch (error) {
        // Ignore inaccessible iframes.
      }
    });
  }

  function prepareToggleEditor() {
    listTinyEditors().forEach((editor) => {
      try {
        if (isEditorVisualMode(editor)) {
          restoreEditorToField(editor);
          return;
        }

        syncEditorFieldValue(editor);
      } catch (error) {
        // Ignore editors that are not ready yet.
      }
    });

    document.querySelectorAll('iframe').forEach((iframe) => {
      if (!isElementVisible(iframe)) {
        return;
      }

      try {
        restorePreviewBlocks(iframe.contentDocument);
        normalizeDocumentShortcodes(iframe.contentDocument);
      } catch (error) {
        // Ignore inaccessible iframes.
      }
    });
  }

  function isToggleEditorControl(element) {
    const control = element?.closest
      ? element.closest('button, a, input, [role="button"], [onclick], [data-action], [data-task]')
      : null;

    if (!control) {
      return false;
    }

    const values = [
      Array.from(control.attributes || [])
        .map((attribute) => `${attribute.name} ${attribute.value}`)
        .join(' '),
      control.textContent,
    ].join(' ').toLowerCase();

    return values.includes('mcetoggleeditor')
      || values.includes('toggleeditor')
      || values.includes('toggle-editor')
      || values.includes('toggle editor')
      || (values.includes('toggle') && values.includes('editor'));
  }

  function handleToggleEditorClick(event) {
    if (!isToggleEditorControl(event.target)) {
      return;
    }

    prepareToggleEditor();
    setTimeout(decorateEditors, 120);
    setTimeout(decorateEditors, 600);
    setTimeout(decorateEditors, 1200);
  }

  function insertPreviewBlock(editor, innerHtml, editing) {
    const id = uid();
    const html = buildBlockHtml(id, innerHtml, editing);

    editor.insertContent(html);
    const doc = editor.getDoc && editor.getDoc();
    const block = doc && doc.querySelector(getBlockSelector(id));

    if (block) {
      setBlockEditing(block, editing, editing);
    } else {
      decorateDocument(doc);
    }

    markEditorDirty(editor);
  }

  function actionOpen(joomlaEditor) {
    const editor = window.tinymce?.activeEditor || null;

    if (editor) {
      const selectedHtml = getSelectedHtmlTiny(editor);
      const hasSelection = selectedHtml.trim() !== '';
      const innerHtml = hasSelection ? selectedHtml : '<p></p>';

      insertPreviewBlock(editor, innerHtml, true);
      return;
    }

    if (joomlaEditor && typeof joomlaEditor.insert === 'function') {
      joomlaEditor.insert(`${SHORTCODE_OPEN}${SHORTCODE_CLOSE}`);
      setTimeout(decorateEditors, 100);
    }
  }

  JoomlaEditorButton.registerAction('sitehiddenbutton:open', actionOpen);

  document.addEventListener('click', handleToggleEditorClick, true);
  document.addEventListener('submit', restoreEditors, true);
  document.addEventListener('DOMContentLoaded', decorateEditors);
  decorateEditors();
  setTimeout(decorateEditors, 250);
  setTimeout(decorateEditors, 1000);
})();
