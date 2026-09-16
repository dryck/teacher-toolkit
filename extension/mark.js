/* Marks the page so the Web Page tile can tell the teacher whether the
   unblocker is actually installed, instead of leaving them guessing why a
   site is blank. Content scripts share the DOM with the page, so setting a
   data attribute here is readable from the toolkit's own scripts. */
document.documentElement.dataset.tkUnblock = '1';
