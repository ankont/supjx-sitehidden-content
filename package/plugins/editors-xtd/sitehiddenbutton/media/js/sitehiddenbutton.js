// ESM: απαιτεί $wa->useScript('editors') και registerScript(..., ['type'=>'module'])
import { JoomlaEditorButton } from 'editor-api';

(function () {
  if (window.__SiteHiddenButtonLoaded) return;
  window.__SiteHiddenButtonLoaded = true;

  // ---------- helpers ----------
  function uid() { return 'sh-' + Math.random().toString(36).slice(2,10); }

  function keepModalAriaVisible(modal) {
    // Αφαίρεσε άμεσα τυχόν aria-hidden
    modal.removeAttribute('aria-hidden');
    modal.setAttribute('aria-modal', 'true');

    // Αν ξαναμπεί κατά λάθος, βγάλ’ το αμέσως
    if (modal._shAriaObserver) modal._shAriaObserver.disconnect();
    modal._shAriaObserver = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'attributes' && m.attributeName === 'aria-hidden') {
          modal.removeAttribute('aria-hidden');
        }
      }
    });
    modal._shAriaObserver.observe(modal, { attributes: true, attributeFilter: ['aria-hidden'] });
  }

  function getSelectedHtmlTiny(ed) {
    try { return ed?.selection?.getContent({ format: 'html' }) || ''; }
    catch (e) { return ''; }
  }

  function getEditorDocFromTiny(ed) {
    try { return ed?.getDoc?.() || null; } catch (e) { return null; }
  }

  function updateHiddenBlockHtml(ed, id, newHtml) {
    if (!ed) return false;
    let ok = false;
    ed.undoManager.transact(() => {
      try {
        const doc = ed.getDoc();
        const sel = `.site-hidden-block[data-site-hidden-id="${CSS && CSS.escape ? CSS.escape(id) : id}"] .site-hidden-inner`;
        const target = doc && doc.querySelector(sel);
        if (target) {
          target.innerHTML = newHtml || '';
          ok = true;
        }
      } catch (e) {}
    });
    if (ok) { ed.nodeChanged(); ed.setDirty(true); }
    return ok;
  }

  function listTinyEditors() {
    if (!window.tinymce) return [];
    if (tinymce.EditorManager && Array.isArray(tinymce.EditorManager.editors)) return tinymce.EditorManager.editors;
    if (Array.isArray(tinymce.editors)) return tinymce.editors;
    if (tinymce.editors && typeof tinymce.editors === 'object') {
      try { return Object.values(tinymce.editors); } catch(e) {}
    }
    return [];
  }

  function findTinyByIframe(ifr) {
    if (!window.tinymce) return null;
    const list = listTinyEditors();
    for (let i = 0; i < list.length; i++) {
      const ed = list[i];
      try {
        if (ed && (ed.iframeElement === ifr || ed.getDoc() === ifr.contentDocument)) return ed;
      } catch (e) {}
    }
    return tinymce.activeEditor || null;
  }

  // ---------- modal ----------
  function ensureModal() {
    const id = 'sitehiddenbutton-modal';
    let el = document.getElementById(id);
    if (el) return el;

    const html =
      '<div class="modal fade" id="'+id+'" tabindex="-1" role="dialog" aria-modal="true">' +
      '  <div class="modal-dialog modal-lg">' +
      '    <div class="modal-content">' +
      '      <div class="modal-header">' +
      '        <h5 class="modal-title">Text Hidden from Site</h5>' +
      '        <button type="button" class="btn-close" id="sitehiddenbutton-close" aria-label="Close"></button>' +
      '      </div>' +
      '      <div class="modal-body">' +
      '        <div class="mb-2 text-muted small">Το περιεχόμενο αυτό θα αφαιρεθεί στο frontend. Θα φαίνεται μόνο στον editor.</div>' +
      '        <textarea id="sitehiddenbutton-textarea" class="form-control" rows="12"></textarea>' +
      '      </div>' +
      '      <div class="modal-footer">' +
      '        <button type="button" class="btn btn-secondary" id="sitehiddenbutton-cancel">Ακύρωση</button>' +
      '        <button type="button" class="btn btn-primary" id="sitehiddenbutton-save">Αποθήκευση</button>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstElementChild);
    el = document.getElementById(id);

    el.querySelector('#sitehiddenbutton-close') .onclick = () => { destroyModalEditor(); hideModal(el); };
    el.querySelector('#sitehiddenbutton-cancel').onclick = () => { destroyModalEditor(); hideModal(el); };

    return el;
  }

  function showModal(el){
    const M = window.bootstrap && window.bootstrap.Modal;
    if (M) {
      M.getOrCreateInstance(el).show();
	  keepModalAriaVisible(el);
    } else {
      el.classList.add('show');
      el.style.display = 'block';
      el.removeAttribute('aria-hidden');
      document.body.classList.add('modal-open');
	  keepModalAriaVisible(el);
      if (!el._shBackdrop) {
        const b = document.createElement('div');
        b.className = 'modal-backdrop fade show';
        b.id = 'sitehiddenbutton-backdrop';
        b.onclick = () => hideModal(el);
        document.body.appendChild(b);
        el._shBackdrop = b;
      }
      if (!el._shEscHandler) {
        el._shEscHandler = (ev) => { if (ev.key === 'Escape') hideModal(el); };
        document.addEventListener('keydown', el._shEscHandler, true);
      }
    }
  }

  function hideModal(el){
    const M = window.bootstrap && window.bootstrap.Modal;
    if (M) {
      M.getOrCreateInstance(el).hide();
    } else {
      el.classList.remove('show');
      el.style.display = 'none';
      el.setAttribute('aria-hidden','true');
      document.body.classList.remove('modal-open');
      if (el._shBackdrop) { el._shBackdrop.remove(); el._shBackdrop = null; }
      if (el._shEscHandler) { document.removeEventListener('keydown', el._shEscHandler, true); el._shEscHandler = null; }
    }
    if (el._shAriaObserver) { el._shAriaObserver.disconnect(); el._shAriaObserver = null; }
  }

  // ---------- modal TinyMCE (Rich Text) ----------
  function ensureModalEditor(initialHtml) {
    const id = 'sitehiddenbutton-textarea';
    const ta = document.getElementById(id);
    if (!window.tinymce) { ta.value = initialHtml || ''; return null; }

    let inst = tinymce.get(id);
    if (!inst) {
      tinymce.init({
        selector: '#' + id,
        menubar: false,
        statusbar: false,
        branding: false,
        height: 320,
        plugins: 'lists link code',
        toolbar: 'undo redo | bold italic underline | bullist numlist | link | removeformat | code',
        setup: (ed) => ed.on('init', () => { ed.setContent(initialHtml || ''); setTimeout(() => ed.focus(), 120); })
      });
    } else {
      inst.setContent(initialHtml || '');
      setTimeout(() => inst.focus(), 120);
    }
    return tinymce.get(id) || null;
  }

  function destroyModalEditor() {
    if (window.tinymce) {
      const inst = tinymce.get('sitehiddenbutton-textarea');
      if (inst) { try { inst.remove(); } catch(e) {} }
    }
  }

  function getModalHtml() {
    if (window.tinymce) {
      const ed = tinymce.get('sitehiddenbutton-textarea');
      if (ed) return ed.getContent({ format: 'html' }) || '';
    }
    const ta = document.getElementById('sitehiddenbutton-textarea');
    return ta ? ta.value || '' : '';
  }

  // ---------- editor styles ----------
  function ensureContentStyles(doc) {
    if (doc.getElementById('sitehiddenbutton-editor-styles')) return;
    const css = `
      .site-hidden-block {
        border: 1px dashed #b7b7b7;
        background: rgba(255,230,0,.12);
        padding: .35rem .5rem;
        border-radius: .35rem;
        margin: .25rem 0;
        cursor: default;
      }
      .site-hidden-badge {
        display: inline-flex;
        align-items: center;
        gap: .35rem;
        font-size: .85em;
        opacity: .85;
        cursor: pointer;
        margin-bottom: .25rem;
      }
      .sh-marker {
        font: inherit;
        font-size: .75em;
        color: #999;
        opacity: .7;
        user-select: none;
        -webkit-user-select: none;
      }
      /* Αν θες να μην φαίνονται καθόλου οι markers:
         .sh-marker { display: none !important; } */
    `;
    const style = doc.createElement('style');
    style.id = 'sitehiddenbutton-editor-styles';
    style.textContent = css;
    (doc.head || doc.documentElement).appendChild(style);
  }

  // ---------- insert block (VISIBLE, TinyMCE API, χωρίς data-mce-object) ----------
  function buildBlockHtml(id, innerHtml) {
    return (
      '<span class="sh-marker sh-open" contenteditable="false">{site-hidden}</span>\n' +
      '<div class="site-hidden-block mceNonEditable" ' +
      '     data-site-hidden="1" data-site-hidden-id="'+id+'" ' +
      '     contenteditable="false">' + // <-- Κρατάμε non-editable, αλλά ΧΩΡΙΣ data-mce-object
      '  <span class="site-hidden-badge">🫥 Κρυφό κείμενο</span>' +
      '  <div class="site-hidden-inner">' + (innerHtml || '') + '</div>' +
      '</div>\n' +
      '<span class="sh-marker sh-close" contenteditable="false">{/site-hidden}</span>'
    );
  }

  function insertBlockWithTiny(ed, presetHtml) {
    const id = uid();
    const html = buildBlockHtml(id, presetHtml || '');
    ed.insertContent(html); // μπαίνει στο μοντέλο του TinyMCE
    const doc = getEditorDocFromTiny(ed);
    if (doc) ensureContentStyles(doc);
  }

  // ---------- dbl-click edit (ασφαλής ενημέρωση μέσω TinyMCE) ----------
  function ensureDblClick() {
    const iframes = document.querySelectorAll('iframe.tox-edit-area__iframe');
    iframes.forEach((ifr) => {
      if (ifr._siteHiddenBound) return;
      let doc = null;
      try { doc = ifr.contentDocument; } catch(e) {}
      if (!doc) return;

      ensureContentStyles(doc);

      doc.addEventListener('dblclick', (e) => {
        const block = e.target?.closest ? e.target.closest('.site-hidden-block') : null;
        if (!block) return;
        e.preventDefault(); e.stopPropagation();

        const inner = block.querySelector('.site-hidden-inner');
        const currentHtml = inner ? inner.innerHTML : '';
        const id = block.getAttribute('data-site-hidden-id') || (() => {
          const i=uid(); block.setAttribute('data-site-hidden-id', i); return i;
        })();

        const modal = ensureModal();
        showModal(modal);
        ensureModalEditor(currentHtml);

        const save = modal.querySelector('#sitehiddenbutton-save');
        save.onclick = function () {
          const newHtml = getModalHtml();
          const ed = findTinyByIframe(ifr) || (window.tinymce && tinymce.activeEditor);

          let ok = false;
          if (ed) ok = updateHiddenBlockHtml(ed, id, newHtml);

          // πολύ σπάνιο fallback αν δεν βρούμε ed:
          if (!ok) {
            try {
              const target = ifr.contentDocument.querySelector('.site-hidden-block[data-site-hidden-id="'+id+'"] .site-hidden-inner');
              if (target) { target.innerHTML = newHtml || ''; ok = true; }
            } catch(e){}
          }

          destroyModalEditor();
          hideModal(modal);
        };

      }, true);

      ifr._siteHiddenBound = true;
    });
  }
  setInterval(ensureDblClick, 800);

  // ---------- button action ----------
  function actionOpen(joomlaEditor) {
    const ed = (window.tinymce && tinymce.activeEditor) || null;

    const modal = ensureModal();
    showModal(modal);
    const selectionHtml = ed ? getSelectedHtmlTiny(ed) : '';
    ensureModalEditor(selectionHtml);
    const save = modal.querySelector('#sitehiddenbutton-save');
    save.onclick = function(){
      const html = getModalHtml();
      if (ed) {
        insertBlockWithTiny(ed, html || '');
      } else if (joomlaEditor && typeof joomlaEditor.insert === 'function') {
        const id = uid();
        joomlaEditor.insert(buildBlockHtml(id, html || ''));
      }
      destroyModalEditor();
      hideModal(modal);
    };
  }

  // ---------- register with Editor API (ESM) ----------
  JoomlaEditorButton.registerAction('sitehiddenbutton:open', actionOpen);
  console.debug('[sitehidden] action registered via editor-api (ESM)');
})();
