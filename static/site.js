document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.getElementById('search_menu_wrapper');
  const open = document.getElementById('search_btn');
  const close = document.getElementById('search_menu_close_btn');
  const results = document.getElementById('search_menu_results');
  if (!wrapper || !open || !close || !results) return;
  const hide = () => { wrapper.classList.add('hidden'); open.focus(); };
  close.addEventListener('click', hide);
  wrapper.addEventListener('click', event => { if (event.target === wrapper) hide(); });
  document.addEventListener('keydown', event => {
    if (wrapper.classList.contains('hidden')) return;
    if (event.key === 'Escape') { event.preventDefault(); hide(); }
    if (event.key === 'Tab') {
      const focusable = [...wrapper.querySelectorAll('input,button,a[href]')];
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  new MutationObserver(() => {
    if (!results.hasChildNodes()) {
      const message = document.createElement('p');
      message.className = 'search-empty';
      message.textContent = '没有找到相关文章，试试其他关键词。';
      results.append(message);
    }
  }).observe(results, { childList: true });
});
