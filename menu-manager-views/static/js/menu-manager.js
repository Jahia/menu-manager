/*
 * Menu Manager, horizontal menus (mnu:navigation, layout "horizontal"). Without this script the
 * dropdown panels open on hover and while focus is inside them; with it:
 * - each top-level item with children shows its disclosure button, which opens and closes its panel
 *   (aria-expanded follows); opening one closes the others of the same menu;
 * - Escape closes the open panel and returns focus to its button; a click outside closes it;
 * - on small screens a "Menu" button shows and hides the whole list.
 * Relies on data-* attributes only, never on (hashed) CSS module class names.
 */
(function () {
  "use strict";

  function close(item) {
    if (!item) return;
    item.removeAttribute("data-open");
    var toggle = item.querySelector("[data-mnu-toggle]");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }

  function init(nav) {
    if (nav.hasAttribute("data-mnu-js")) return;
    nav.setAttribute("data-mnu-js", "");
    var items = Array.prototype.slice.call(nav.querySelectorAll("[data-mnu-item]"));

    items.forEach(function (item) {
      var toggle = item.querySelector("[data-mnu-toggle]");
      if (!toggle) return;
      toggle.hidden = false;
      toggle.addEventListener("click", function () {
        var open = item.hasAttribute("data-open");
        items.forEach(close);
        if (!open) {
          item.setAttribute("data-open", "");
          toggle.setAttribute("aria-expanded", "true");
        }
      });
    });

    nav.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var open = nav.querySelector("[data-mnu-item][data-open]");
      if (open) {
        close(open);
        var toggle = open.querySelector("[data-mnu-toggle]");
        if (toggle) toggle.focus();
      }
    });

    document.addEventListener("click", function (event) {
      if (!nav.contains(event.target)) items.forEach(close);
    });

    var mobile = nav.querySelector("[data-mnu-mobile]");
    if (mobile) {
      mobile.hidden = false;
      mobile.addEventListener("click", function () {
        var open = nav.hasAttribute("data-mobile-open");
        if (open) nav.removeAttribute("data-mobile-open");
        else nav.setAttribute("data-mobile-open", "");
        mobile.setAttribute("aria-expanded", open ? "false" : "true");
      });
    }
  }

  function initAll() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-mnu-nav]"), init);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll);
  else initAll();
})();
