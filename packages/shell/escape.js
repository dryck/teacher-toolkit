/* Teacher Toolkit — shared HTML escaper.

   Anything a student types (a name, a poll answer, a "Wall of Yet" entry)
   gets rendered back onto a projected teacher screen via innerHTML, so it
   has to be escaped. This exact helper had been copy-pasted into 11 pages;
   10 of those copies assumed `str` was always a string and would render a
   literal "undefined"/"null" for a missing Firestore field. This is the
   null-safe version (previously only in behaviour-tracker), so every tool
   now gets the better behaviour.

   Deliberately exposed under its plain name rather than a TK* namespace:
   all 27 existing call sites already say `escapeHtml(...)`, so sharing it
   is a pure deletion of the duplicates with no call-site churn.

   Loaded from <head> — it touches the DOM only when called, never at load
   time, so it is safe there and is guaranteed to exist before any inline
   page script runs. */
(function () {
  var div = null;

  window.escapeHtml = function (str) {
    // One reused detached element instead of one per call.
    if (!div) div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  };
})();
