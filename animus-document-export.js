/* Customer-copy PDF export, isolated from editor styling and CRM persistence. */
(() => {
  function pageSlices(height, pageHeight, blocks = []) {
    const slices = [];
    let top = 0;
    while (top < height) {
      let bottom = Math.min(height, top + pageHeight);
      if (bottom < height) {
        const crossing = blocks.filter(([start, end]) => start > top + pageHeight * .25 && start < bottom && end > bottom && end - start < pageHeight);
        if (crossing.length) bottom = Math.floor(Math.min(...crossing.map(([start]) => start)));
      }
      slices.push([top, bottom]);
      top = bottom;
    }
    return slices;
  }

  async function createPdf(source, options = {}) {
    const progress = message => options.onProgress?.(message);
    const bounded = (promise, message, milliseconds = 20000) => {
      let timer;
      return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })]).finally(() => clearTimeout(timer));
    };
    if (!source || !window.jspdf?.jsPDF || !window.html2canvas) throw new Error('PDF tools could not load. Check your connection and try again.');
    const frame = document.createElement('iframe');
    frame.title = 'PDF render copy';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:1200px;border:0;pointer-events:none;';
    const loaded = new Promise((resolve, reject) => {
      frame.onload = resolve;
      frame.onerror = () => reject(new Error('The PDF document could not initialize. Retry the export.'));
    });
    frame.srcdoc = '<!doctype html><html><head></head><body></body></html>';
    document.body.append(frame);
    try {
      await bounded(loaded, 'The PDF document took too long to initialize. Retry the export.');
      const output = frame.contentDocument;
      const base = output.createElement('base');
      base.href = document.baseURI;
      output.head.append(base);
      document.querySelectorAll('style,link[rel="stylesheet"]').forEach(node => output.head.append(node.cloneNode(true)));
      // Activate the existing print design without opening a browser print dialog.
      const printRules = [];
      [...document.styleSheets].forEach(sheet => {
        try {
          [...sheet.cssRules].forEach(rule => {
            if (rule.type === 4 && rule.conditionText === 'print') printRules.push(...[...rule.cssRules].map(child => child.cssText));
          });
        } catch (_) { /* External stylesheets are not needed for the customer copy. */ }
      });
      const style = output.createElement('style');
      style.textContent = printRules.join('\n') + '\nhtml,body{margin:0!important;padding:0!important;background:#fff!important;color:#202124!important;width:900px!important;min-width:0!important;overflow:visible!important}.estimate-sheet{display:block!important;margin:0!important;overflow:visible!important}.header-estimate-number{position:static!important;display:block!important}.estimate-warranty-attachment{display:block!important;}';
      output.head.append(style);
      const copy = source.cloneNode(true);
      const warranties = [...copy.querySelectorAll('.estimate-warranty-attachment')];
      warranties.forEach(node => node.remove());
      output.body.append(copy);
      const sections = [copy];
      warranties.forEach(warranty => {
        const wrapper = output.createElement('article');
        wrapper.className = 'estimate-sheet';
        wrapper.append(warranty);
        output.body.append(wrapper);
        sections.push(wrapper);
      });
      progress('Loading document fonts...');
      await bounded(output.fonts.ready, 'Document fonts could not load. Retry the PDF export.');
      progress('Loading document images...');
      await bounded(Promise.all([...output.images].map(async image => {
        if (!image.complete) await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error('A document image could not load. Retry the PDF export.'));
        });
        if (!image.naturalWidth) throw new Error('A document image could not load. Retry the PDF export.');
      })), 'Document images took too long to load. Retry the PDF export.');
      const doc = new window.jspdf.jsPDF({unit:'mm', format:'letter', compress:true});
      const margin = 8.9;
      const width = doc.internal.pageSize.getWidth() - margin * 2;
      const height = doc.internal.pageSize.getHeight() - margin * 2;
      let page = 0;
      for (const section of sections) {
        section.dataset.pdfSection = String(sections.indexOf(section));
        let rect, measuredBlocks, links;
        progress('Rendering estimate pages...');
        const canvas = await bounded(window.html2canvas(section, {
          backgroundColor:'#fff', scale:2, useCORS:true, logging:Boolean(options.debug), windowWidth:900, windowHeight:Math.ceil(section.scrollHeight), scrollX:0, scrollY:0,
          onclone(clonedDocument) {
            const rendered = clonedDocument.querySelector(`[data-pdf-section="${section.dataset.pdfSection}"]`);
            rect = rendered.getBoundingClientRect();
            progress('Composing estimate pages...');
            measuredBlocks = [...rendered.querySelectorAll('tr,p,li,h2,h3,.totals,figure,.warranty-summary,.estimate-footer,.warranty-section,.warranty-doc-header,.warranty-intro,.warranty-commitment')].map(node => {
              const bounds = node.getBoundingClientRect();
              return [bounds.top - rect.top, bounds.bottom - rect.top];
            });
            links = [...rendered.querySelectorAll('a[href]')].map(anchor => ({url:anchor.href,rect:anchor.getBoundingClientRect()}));
          },
        }), 'Document rendering took too long. Retry the PDF export.', 45000);
        if (!canvas.width || !canvas.height) throw new Error('The document could not be rendered. Your invoice is unchanged.');
        const ratio = canvas.width / rect.width;
        const blocks = measuredBlocks.map(([top,bottom]) => [top * ratio,bottom * ratio]);
        for (const [top, bottom] of pageSlices(canvas.height, Math.floor(height * canvas.width / width), blocks)) {
          progress('Assembling the PDF...');
          if (page++) doc.addPage('letter');
          const slice = output.createElement('canvas');
          slice.width = canvas.width;
          slice.height = bottom - top;
          slice.getContext('2d').drawImage(canvas,0,top,canvas.width,slice.height,0,0,canvas.width,slice.height);
          doc.addImage(slice.toDataURL('image/png'),'PNG',margin,margin,width,slice.height * width / canvas.width,undefined,'FAST');
          links.forEach(link => {
            const linkTop = (link.rect.top - rect.top) * ratio;
            if (linkTop >= top && linkTop < bottom) doc.link(margin + (link.rect.left - rect.left) * width / rect.width, margin + (linkTop - top) * width / canvas.width, link.rect.width * width / rect.width, link.rect.height * width / rect.width, {url:link.url});
          });
        }
        canvas.width = canvas.height = 0;
      }
      progress('Finishing the PDF...');
      return doc.output('blob');
    } finally {
      frame.remove();
    }
  }

  function download(blob, filename) {
    let host = window;
    try {
      if (window.parent !== window && window.parent.location.origin === window.location.origin) host = window.parent;
    } catch (_) { /* Standalone and cross-origin embeds use their own document. */ }
    const url = host.URL.createObjectURL(blob);
    const link = host.document.createElement('a');
    link.href = url;
    link.download = filename;
    host.document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => host.URL.revokeObjectURL(url),60000);
  }
  window.AnimusDocumentExport = {createPdf, download, pageSlices};
})();
