(function () {
  try {
    var t = localStorage.getItem('sever_theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
