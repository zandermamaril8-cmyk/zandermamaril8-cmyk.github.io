// family.js - Family & Friends interactive tree
// Needs: the #family popup, .person cards and #const-card in index.html
(function () {
  var pop = document.getElementById('family');
  var card = document.getElementById('const-card');
  if (!pop || !card) return;

  var DEFAULT = card.innerHTML;
  var cards = pop.querySelectorAll('.person');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Show the selected person in the bottom panel
  function show(el) {
    cards.forEach(function (c) { c.classList.toggle('active', c === el); });
    card.innerHTML = '<span class="const-role"></span><p class="const-name"></p><p class="const-line"></p>';
    card.children[0].textContent = el.dataset.role;
    card.children[1].textContent = el.dataset.name;
    card.children[2].textContent = el.dataset.line;
    card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap');
  }

  cards.forEach(function (el) {
    el.addEventListener('click', function () { show(el); });
    el.addEventListener('focus', function () { show(el); });
    el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') show(el); });

    // 3D tilt + light that follows the mouse
    el.addEventListener('pointermove', function (e) {
      if (still || e.pointerType !== 'mouse') return;
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--ry', ((x - 0.5) * 12) + 'deg');
      el.style.setProperty('--rx', ((0.5 - y) * 12) + 'deg');
      el.style.setProperty('--mx', (x * 100) + '%');
      el.style.setProperty('--my', (y * 100) + '%');
    });
    el.addEventListener('pointerleave', function () {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  });

  // Reset the panel every time the popup opens
  pop.addEventListener('toggle', function (e) {
    if (e.newState !== 'open') return;
    card.innerHTML = DEFAULT;
    card.classList.remove('swap');
    cards.forEach(function (c) { c.classList.remove('active'); });
  });
})();
