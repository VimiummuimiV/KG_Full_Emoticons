import { categories, settings } from "./data/definitions.js";

export function onFocusIn(e, appContext) {
  const { state } = appContext;
  if (e.target.matches("textarea, input.text, input#message-input")) {
    state.lastFocusedInput = e.target;
  }
}

export function onKeyDown(e, appContext) {
  const { state, toggleEmoticonsPopup, removeEmoticonsPopup } = appContext;
  if (e.code === 'KeyV' && e.ctrlKey) {
    const popup = document.querySelector(".emoticons-popup");
    if (popup) removeEmoticonsPopup();
    return;
  }
  if (e.code === 'KeyQ') {
    handleDoubleKeyPress(e, 'KeyQ', 500, function () {
      if (state.lastFocusedInput) {
        let value = state.lastFocusedInput.value;
        if (value.length >= 2 && value.slice(-1) === value.slice(-2, -1)) {
          value = value.slice(0, -2);
        } else if (value.length >= 1) {
          value = value.slice(0, -1);
        }
        state.lastFocusedInput.value = value;
        const pos = value.length;
        state.lastFocusedInput.setSelectionRange(pos, pos);
      }
      toggleEmoticonsPopup();
    }, appContext);
  } else {
    state.lastKeyTimes['KeyQ'] = 0;
  }
}

export function onMouseUp(e, appContext) {
  const { toggleEmoticonsPopup } = appContext;
  if (e.ctrlKey && e.button === 0 && e.target.matches("textarea, input.text, input#message-input")) {
    e.preventDefault();
    toggleEmoticonsPopup();
  }
}

export function closePopupOnKeydown(e, appContext) {
  const { removeEmoticonsPopup } = appContext;
  const popup = document.querySelector(".emoticons-popup");
  if (popup && (e.code === 'Escape' || e.code === 'KeyQ')) {
    e.preventDefault();
    removeEmoticonsPopup();
  }
}

export function closePopupOnClickOutside(e, appContext) {
  const { removeEmoticonsPopup } = appContext;
  const popup = document.querySelector(".emoticons-popup");
  if (popup && !popup.contains(e.target)) {
    removeEmoticonsPopup();
  }
}

export function navigateEmoticons(e, appContext) {
  const { state, insertEmoticonCode, incrementEmoticonUsage, removeEmoticonsPopup, updateEmoticonHighlight, navigateSelection } = appContext;
  const popup = document.querySelector(".emoticons-popup");
  if (!popup) return;

  const handledKeys = new Set([
    // Insert
    "Enter", "Semicolon", "KeyA",
    // Navigate (default keys)
    "ArrowLeft", "ArrowRight",
    // Navigate (right hand)
    "KeyJ", "KeyK",
    // Navigate (left hand)
    "KeyS", "KeyF",
    // Change section
    "KeyD"
  ]);
  if (!handledKeys.has(e.code)) return;
  e.preventDefault();

  // Section switch (D key)
  if (e.code === "KeyD") {
    const hasRecents = document.querySelector(".recent-emoticon-buttons") !== null;
    if (state.focusedSection === "category" && hasRecents) {
      state.focusedSection = "recent";
      // ensure lastUsedRecentEmoticon is within bounds
      if (state.lastUsedRecentEmoticon < 0 || state.lastUsedRecentEmoticon >= state.recentEmoticons.length) {
        state.lastUsedRecentEmoticon = 0;
        localStorage.setItem("lastUsedRecentEmoticon", JSON.stringify(0));
      }
    } else {
      state.focusedSection = "category";
    }
    updateEmoticonHighlight();
    return;
  }

  // Selection and insertion
  if (e.code === "Enter" || e.code === "Semicolon" || e.code === "KeyA") {
    let emoticon;
    if (state.focusedSection === "category") {
      emoticon = state.lastUsedCategoryEmoticons[state.activeCategory];
    } else if (state.focusedSection === "recent" && state.lastUsedRecentEmoticon < state.recentEmoticons.length) {
      emoticon = state.recentEmoticons[state.lastUsedRecentEmoticon];
    }
    if (emoticon) {
      insertEmoticonCode(emoticon);
      incrementEmoticonUsage(emoticon);
      if (!e.shiftKey) removeEmoticonsPopup();
    }
    return;
  }

  // Navigation (backward)
  if (e.code === "ArrowLeft" || e.code === "KeyJ" || e.code === "KeyS") {
    navigateSelection(-1);
  // Navigation (forward)
  } else if (e.code === "ArrowRight" || e.code === "KeyK" || e.code === "KeyF") {
    navigateSelection(1);
  }
}

export function switchEmoticonCategory(e, appContext) {
  const { state, getSortedEmoticons, changeActiveCategoryOnClick, updateToggleButtonIcon } = appContext;
  const emoticonPopup = document.querySelector(".emoticons-popup");
  if (!emoticonPopup || (!(["Tab", "KeyH", "KeyL", "KeyW", "KeyR"].includes(e.code)) && !(e.code === "Tab" && e.shiftKey))) return;
  e.preventDefault();

  const keys = Object.keys(categories);
  const favs = JSON.parse(localStorage.getItem("favoriteEmoticons")) || [];
  const navKeys = favs.length === 0 ? keys.filter(key => key !== "Favourites") : keys;
  let idx = navKeys.indexOf(state.activeCategory);
  if (idx === -1) idx = 0;

  let newIdx = ((e.code === "Tab" && !e.shiftKey) || e.code === "KeyL" || e.code === "KeyR") && idx < navKeys.length - 1 ? idx + 1 :
    ((e.code === "KeyH" || e.code === "KeyW" || (e.code === "Tab" && e.shiftKey)) && idx > 0) ? idx - 1 : idx;
  if (newIdx === idx) return;

  const next = navKeys[newIdx];
  state.currentSortedEmoticons = getSortedEmoticons(next);
  localStorage.setItem("activeCategory", next);
  changeActiveCategoryOnClick(next);
  updateToggleButtonIcon();
}

// Helper functions
export function handleDoubleKeyPress(e, targetKey, threshold, callback, appContext) {
  const { state } = appContext;
  const now = Date.now();
  if (e.code === targetKey) {
    if (now - (state.lastKeyTimes[targetKey] || 0) < threshold) {
      e.preventDefault();
      callback();
      state.lastKeyTimes[targetKey] = 0;
    } else {
      state.lastKeyTimes[targetKey] = now;
    }
  } else {
    state.lastKeyTimes[targetKey] = 0;
  }
}

export function setupLongPress(container, longPressCallback) {
  let longPressTimer;
  let longPressTarget = null;
  container.addEventListener("pointerdown", e => {
    const btn = e.target.closest("button.emoticon-button");
    if (!btn) return;
    longPressTarget = btn;
    longPressTimer = setTimeout(() => {
      if (longPressTarget) {
        e.preventDefault();
        longPressCallback(longPressTarget);
        longPressTarget = null;
      }
    }, settings.longPressDelay);
  });
  const clearLongPressTimer = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };
  container.addEventListener("pointerup", clearLongPressTimer);
  container.addEventListener("pointerleave", clearLongPressTimer);
  container.addEventListener("pointercancel", clearLongPressTimer);
  return () => longPressTarget;
}

export function handleEmoticonButtonClick(e, getLongPressTarget, onClickAction) {
  const btn = e.target.closest("button.emoticon-button");
  if (!btn || !getLongPressTarget()) return;
  e.stopPropagation();
  const emoticon = btn.title;
  onClickAction(emoticon, e);
}

// Setup functions
export function setupDocumentEventListeners(appContext) {
  document.addEventListener("focusin", (e) => onFocusIn(e, appContext));
  document.addEventListener("mouseup", (e) => onMouseUp(e, appContext));
  document.addEventListener("keydown", (e) => onKeyDown(e, appContext));
}

export function setupPopupEventListeners(appContext) {
  const listeners = [
    { event: "keydown", handler: (e) => navigateEmoticons(e, appContext) },
    { event: "keydown", handler: (e) => switchEmoticonCategory(e, appContext) },
    { event: "keydown", handler: (e) => closePopupOnKeydown(e, appContext) },
    { event: "click", handler: (e) => closePopupOnClickOutside(e, appContext) }
  ];
  listeners.forEach(({ event, handler }) => {
    document.addEventListener(event, handler);
  });
  return listeners.map(({ event, handler }) => ({ event, handler }));
}

export function setupEmoticonButtonEvents(container, onLongPress, onClick) {
  const getLongPressTarget = setupLongPress(container, (target) => {
    onLongPress(target.title);
  });
  container.addEventListener("click", e => handleEmoticonButtonClick(e, getLongPressTarget, onClick));
}

export function setupCategoryButtonEvents(container, onCategoryClick, onFavouritesClick) {
  container.addEventListener("click", e => {
    const btn = e.target.closest("button.category-button");
    if (!btn) return;
    const cat = btn.dataset.category;
    if (cat === "Favourites" && e.ctrlKey) {
      onFavouritesClick(e);
    } else {
      onCategoryClick(cat, e);
    }
  });
}

export function setupRecentEmoticonButtonEvents(container, onLongPress, onClick) {
  const getLongPressTarget = setupLongPress(container, (target) => {
    onLongPress(target.title, target);
  });
  container.addEventListener("click", e => handleEmoticonButtonClick(e, getLongPressTarget, onClick));
}
